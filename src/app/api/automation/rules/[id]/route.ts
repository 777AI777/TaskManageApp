import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole, assertWorkspaceRole } from "@/lib/permissions";
import { automationRulePatchSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, automationRulePatchSchema);
    const { supabase, user } = await requireApiUser();

    const { data: rule, error: ruleLookupError } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (ruleLookupError) {
      throw new ApiError(500, "automation_rule_lookup_failed", ruleLookupError.message);
    }
    if (!rule) {
      throw new ApiError(404, "automation_rule_not_found", "自動化ルールが見つかりません。");
    }

    if (rule.board_id) {
      await assertBoardRole(supabase, rule.board_id, user.id, ["board_admin"]);
    } else {
      await assertWorkspaceRole(supabase, rule.workspace_id, user.id, ["workspace_admin"]);
    }

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.name !== undefined) updatePayload.name = payload.name;
    if (payload.trigger !== undefined) updatePayload.trigger = payload.trigger;
    if (payload.boardId !== undefined) updatePayload.board_id = payload.boardId;
    if (payload.isActive !== undefined) updatePayload.is_active = payload.isActive;

    const { data: updatedRule, error: updateError } = await supabase
      .from("automation_rules")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) {
      throw new ApiError(500, "automation_rule_update_failed", updateError.message);
    }

    if (payload.conditions) {
      const { error: clearConditionError } = await supabase
        .from("automation_rule_conditions")
        .delete()
        .eq("rule_id", id);
      if (clearConditionError) {
        throw new ApiError(500, "automation_condition_clear_failed", clearConditionError.message);
      }

      if (payload.conditions.length) {
        const { error: insertConditionError } = await supabase
          .from("automation_rule_conditions")
          .insert(
            payload.conditions.map((condition, index) => ({
              rule_id: id,
              condition_type: condition.type,
              condition_payload: condition.payload,
              position: condition.position ?? index,
            })),
          );
        if (insertConditionError) {
          throw new ApiError(500, "automation_condition_upsert_failed", insertConditionError.message);
        }
      }
    }

    if (payload.actions) {
      const { error: clearActionError } = await supabase
        .from("automation_rule_actions")
        .delete()
        .eq("rule_id", id);
      if (clearActionError) {
        throw new ApiError(500, "automation_action_clear_failed", clearActionError.message);
      }

      if (payload.actions.length) {
        const { error: insertActionError } = await supabase
          .from("automation_rule_actions")
          .insert(
            payload.actions.map((action, index) => ({
              rule_id: id,
              action: action.action,
              action_payload: action.payload,
              position: action.position ?? index,
            })),
          );
        if (insertActionError) {
          throw new ApiError(500, "automation_action_upsert_failed", insertActionError.message);
        }
      }
    }

    return ok(updatedRule);
  } catch (error) {
    return fail(error as Error);
  }
}
