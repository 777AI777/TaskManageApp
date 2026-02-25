import { addHours } from "date-fns";

import { runAutomationForEvent } from "@/lib/automation/engine";
import { getAutomationSecret } from "@/lib/env";
import { ApiError, fail, ok } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

async function enrichCardContext(supabase: ReturnType<typeof createSupabaseAdminClient>, cardId: string) {
  const [{ data: assignees }, { data: labels }] = await Promise.all([
    supabase.from("card_assignees").select("user_id").eq("card_id", cardId),
    supabase.from("card_labels").select("label_id").eq("card_id", cardId),
  ]);
  return {
    assigneeIds: (assignees ?? []).map((row) => row.user_id),
    labelIds: (labels ?? []).map((row) => row.label_id),
  };
}

export async function POST(request: Request) {
  try {
    const secret = getAutomationSecret();
    if (!secret) {
      throw new ApiError(500, "missing_cron_secret", "AUTOMATION_CRON_SECRETが未設定です。");
    }
    const headerSecret = request.headers.get("x-automation-secret");
    const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (headerSecret !== secret && bearerToken !== secret) {
      throw new ApiError(401, "unauthorized", "Invalid automation secret.");
    }

    const supabase = createSupabaseAdminClient();
    const now = new Date();
    const soon = addHours(now, 24);

    const [{ data: dueSoonCards }, { data: overdueCards }] = await Promise.all([
      supabase
        .from("cards")
        .select("id, board_id, list_id, priority, due_at, created_by")
        .eq("archived", false)
        .gte("due_at", now.toISOString())
        .lte("due_at", soon.toISOString()),
      supabase
        .from("cards")
        .select("id, board_id, list_id, priority, due_at, created_by")
        .eq("archived", false)
        .lt("due_at", now.toISOString()),
    ]);

    let processed = 0;

    for (const card of dueSoonCards ?? []) {
      const { data: board } = await supabase
        .from("boards")
        .select("workspace_id")
        .eq("id", card.board_id)
        .maybeSingle();
      if (!board) {
        continue;
      }
      const context = await enrichCardContext(supabase, card.id);
      await runAutomationForEvent(supabase, {
        trigger: "due_soon",
        workspaceId: board.workspace_id,
        boardId: card.board_id,
        actorId: card.created_by,
        card: {
          id: card.id,
          board_id: card.board_id,
          list_id: card.list_id,
          priority: card.priority,
          due_at: card.due_at,
          assigneeIds: context.assigneeIds,
          labelIds: context.labelIds,
        },
      });
      processed += 1;
    }

    for (const card of overdueCards ?? []) {
      const { data: board } = await supabase
        .from("boards")
        .select("workspace_id")
        .eq("id", card.board_id)
        .maybeSingle();
      if (!board) {
        continue;
      }
      const context = await enrichCardContext(supabase, card.id);
      await runAutomationForEvent(supabase, {
        trigger: "overdue",
        workspaceId: board.workspace_id,
        boardId: card.board_id,
        actorId: card.created_by,
        card: {
          id: card.id,
          board_id: card.board_id,
          list_id: card.list_id,
          priority: card.priority,
          due_at: card.due_at,
          assigneeIds: context.assigneeIds,
          labelIds: context.labelIds,
        },
      });
      processed += 1;
    }

    return ok({ processed, dueSoon: dueSoonCards?.length ?? 0, overdue: overdueCards?.length ?? 0 });
  } catch (error) {
    return fail(error as Error);
  }
}
