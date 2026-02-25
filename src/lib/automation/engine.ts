import type { SupabaseClient } from "@supabase/supabase-js";
import { addHours } from "date-fns";

import type { AutomationAction, AutomationTrigger, Card } from "@/lib/types";

type RuleCondition = {
  id: string;
  condition_type: string;
  condition_payload: Record<string, unknown>;
  position: number;
};

type RuleAction = {
  id: string;
  action: AutomationAction;
  action_payload: Record<string, unknown>;
  position: number;
};

type Rule = {
  id: string;
  workspace_id: string;
  board_id: string | null;
  trigger: AutomationTrigger;
  is_active: boolean;
  name: string;
};

export type AutomationEvent = {
  trigger: AutomationTrigger;
  workspaceId: string;
  boardId: string;
  actorId: string;
  card: Pick<Card, "id" | "board_id" | "list_id" | "priority" | "due_at"> & {
    labelIds?: string[];
    assigneeIds?: string[];
  };
};

function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function getPayloadNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "number" ? value : null;
}

export function evaluateCondition(event: AutomationEvent, condition: RuleCondition) {
  const payload = condition.condition_payload ?? {};
  switch (condition.condition_type) {
    case "card_priority_is": {
      const expected = getPayloadString(payload, "priority");
      return expected ? event.card.priority === expected : true;
    }
    case "label_is": {
      const expectedLabelId = getPayloadString(payload, "labelId");
      if (!expectedLabelId) {
        return true;
      }
      return event.card.labelIds?.includes(expectedLabelId) ?? false;
    }
    case "assignee_is": {
      const expectedUserId = getPayloadString(payload, "userId");
      if (!expectedUserId) {
        return true;
      }
      return event.card.assigneeIds?.includes(expectedUserId) ?? false;
    }
    case "due_within_hours": {
      const threshold = getPayloadNumber(payload, "hours");
      if (!threshold || !event.card.due_at) {
        return false;
      }
      const dueAt = new Date(event.card.due_at).valueOf();
      const now = Date.now();
      return dueAt - now <= threshold * 3600 * 1000;
    }
    case "list_is": {
      const expectedListId = getPayloadString(payload, "listId");
      return expectedListId ? event.card.list_id === expectedListId : true;
    }
    default:
      return true;
  }
}

async function executeAction(
  supabase: SupabaseClient,
  event: AutomationEvent,
  action: RuleAction,
) {
  const payload = action.action_payload ?? {};
  switch (action.action) {
    case "move_card": {
      const targetListId = getPayloadString(payload, "listId");
      if (!targetListId) {
        return;
      }
      const targetPosition = getPayloadNumber(payload, "position") ?? Date.now();
      await supabase
        .from("cards")
        .update({ list_id: targetListId, position: targetPosition })
        .eq("id", event.card.id);
      return;
    }
    case "add_label": {
      const labelId = getPayloadString(payload, "labelId");
      if (!labelId) {
        return;
      }
      await supabase
        .from("card_labels")
        .upsert({ card_id: event.card.id, label_id: labelId }, { onConflict: "card_id,label_id" });
      return;
    }
    case "assign_member": {
      const userId = getPayloadString(payload, "userId");
      if (!userId) {
        return;
      }
      await supabase.from("card_assignees").upsert(
        {
          card_id: event.card.id,
          user_id: userId,
          assigned_by: event.actorId,
        },
        { onConflict: "card_id,user_id" },
      );
      return;
    }
    case "set_due_date": {
      const offsetHours = getPayloadNumber(payload, "offsetHours");
      const dueAt = addHours(new Date(), offsetHours ?? 24).toISOString();
      await supabase.from("cards").update({ due_at: dueAt }).eq("id", event.card.id);
      return;
    }
    case "post_comment": {
      const content = getPayloadString(payload, "content");
      if (!content) {
        return;
      }
      await supabase.from("comments").insert({
        card_id: event.card.id,
        user_id: event.actorId,
        content,
      });
      return;
    }
    case "notify": {
      const userId = getPayloadString(payload, "userId");
      if (!userId) {
        return;
      }
      await supabase.from("notifications").insert({
        user_id: userId,
        workspace_id: event.workspaceId,
        board_id: event.boardId,
        card_id: event.card.id,
        type: "automation",
        message: `自動化ルールによりカード「${event.card.id}」が更新されました。`,
        payload,
      });
      return;
    }
    default:
      return;
  }
}

export async function runAutomationForEvent(
  supabase: SupabaseClient,
  event: AutomationEvent,
) {
  const { data: rules, error: rulesError } = await supabase
    .from("automation_rules")
    .select("id, workspace_id, board_id, trigger, is_active, name")
    .eq("workspace_id", event.workspaceId)
    .eq("trigger", event.trigger)
    .eq("is_active", true);

  if (rulesError || !rules?.length) {
    return;
  }

  const scopedRules = rules.filter((rule) => !rule.board_id || rule.board_id === event.boardId) as Rule[];
  if (!scopedRules.length) {
    return;
  }

  const ruleIds = scopedRules.map((rule) => rule.id);
  const [{ data: conditions }, { data: actions }] = await Promise.all([
    supabase
      .from("automation_rule_conditions")
      .select("id, rule_id, condition_type, condition_payload, position")
      .in("rule_id", ruleIds)
      .order("position", { ascending: true }),
    supabase
      .from("automation_rule_actions")
      .select("id, rule_id, action, action_payload, position")
      .in("rule_id", ruleIds)
      .order("position", { ascending: true }),
  ]);

  const conditionMap = new Map<string, RuleCondition[]>();
  const actionMap = new Map<string, RuleAction[]>();

  (conditions ?? []).forEach((condition) => {
    const list = conditionMap.get(condition.rule_id) ?? [];
    list.push(condition as RuleCondition);
    conditionMap.set(condition.rule_id, list);
  });

  (actions ?? []).forEach((action) => {
    const list = actionMap.get(action.rule_id) ?? [];
    list.push(action as RuleAction);
    actionMap.set(action.rule_id, list);
  });

  for (const rule of scopedRules) {
    const runStart = new Date().toISOString();
    try {
      const matched = (conditionMap.get(rule.id) ?? []).every((condition) =>
        evaluateCondition(event, condition),
      );
      if (!matched) {
        continue;
      }

      for (const action of actionMap.get(rule.id) ?? []) {
        await executeAction(supabase, event, action);
      }

      await supabase.from("automation_runs").insert({
        rule_id: rule.id,
        trigger_source: event.trigger,
        status: "success",
        details: { cardId: event.card.id },
        started_at: runStart,
        finished_at: new Date().toISOString(),
      });
    } catch (error) {
      await supabase.from("automation_runs").insert({
        rule_id: rule.id,
        trigger_source: event.trigger,
        status: "failed",
        details: {
          cardId: event.card.id,
          message: error instanceof Error ? error.message : "unknown error",
        },
        started_at: runStart,
        finished_at: new Date().toISOString(),
      });
    }
  }
}
