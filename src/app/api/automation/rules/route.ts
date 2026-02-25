import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole, assertWorkspaceRole } from "@/lib/permissions";
import { automationRuleCreateSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const payload = await parseBody(request, automationRuleCreateSchema);
    const { supabase, user } = await requireApiUser();

    if (payload.boardId) {
      await assertBoardRole(supabase, payload.boardId, user.id, ["board_admin"]);
    } else {
      await assertWorkspaceRole(supabase, payload.workspaceId, user.id, ["workspace_admin"]);
    }

    const { data: rule, error: ruleError } = await supabase
      .from("automation_rules")
      .insert({
        workspace_id: payload.workspaceId,
        board_id: payload.boardId ?? null,
        name: payload.name,
        trigger: payload.trigger,
        is_active: payload.isActive,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (ruleError) {
      throw new ApiError(500, "automation_rule_create_failed", ruleError.message);
    }

    const conditionRows = payload.conditions.map((condition) => ({
      rule_id: rule.id,
      condition_type: condition.type,
      condition_payload: condition.payload,
      position: condition.position,
    }));
    const actionRows = payload.actions.map((action) => ({
      rule_id: rule.id,
      action: action.action,
      action_payload: action.payload,
      position: action.position,
    }));

    if (conditionRows.length) {
      const { error: conditionError } = await supabase
        .from("automation_rule_conditions")
        .insert(conditionRows);
      if (conditionError) {
        throw new ApiError(500, "automation_condition_create_failed", conditionError.message);
      }
    }

    const { error: actionError } = await supabase.from("automation_rule_actions").insert(actionRows);
    if (actionError) {
      throw new ApiError(500, "automation_action_create_failed", actionError.message);
    }

    return ok(rule, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
