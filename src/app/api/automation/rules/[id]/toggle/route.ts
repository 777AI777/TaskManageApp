import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole, assertWorkspaceRole } from "@/lib/permissions";

const toggleSchema = z.object({
  isActive: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, toggleSchema);
    const { supabase, user } = await requireApiUser();

    const { data: rule, error: ruleLookupError } = await supabase
      .from("automation_rules")
      .select("id, workspace_id, board_id")
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

    const { data: updatedRule, error: updateError } = await supabase
      .from("automation_rules")
      .update({
        is_active: payload.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) {
      throw new ApiError(500, "automation_rule_toggle_failed", updateError.message);
    }

    return ok(updatedRule);
  } catch (error) {
    return fail(error as Error);
  }
}
