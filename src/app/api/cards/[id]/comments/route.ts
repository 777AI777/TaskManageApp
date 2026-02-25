import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { createNotification, logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { commentCreateSchema } from "@/lib/validation/schemas";

function extractMentionedUserIds(content: string) {
  const matches = content.matchAll(/@\[([0-9a-fA-F-]{36})\]/g);
  return Array.from(matches).map((match) => match[1]);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, commentCreateSchema);
    const { supabase, user } = await requireApiUser();

    const { data: card, error: cardLookupError } = await supabase
      .from("cards")
      .select("id, board_id, title")
      .eq("id", id)
      .maybeSingle();
    if (cardLookupError) {
      throw new ApiError(500, "card_lookup_failed", cardLookupError.message);
    }
    if (!card) {
      throw new ApiError(404, "card_not_found", "カードが見つかりません。");
    }

    await assertBoardRole(supabase, card.board_id, user.id, ["member"]);

    const { data: board, error: boardLookupError } = await supabase
      .from("boards")
      .select("workspace_id")
      .eq("id", card.board_id)
      .maybeSingle();
    if (boardLookupError) {
      throw new ApiError(500, "board_lookup_failed", boardLookupError.message);
    }
    if (!board) {
      throw new ApiError(404, "board_not_found", "ボードが見つかりません。");
    }

    const { data: comment, error: commentError } = await supabase
      .from("comments")
      .insert({
        card_id: id,
        user_id: user.id,
        content: payload.content,
      })
      .select("*")
      .single();
    if (commentError) {
      throw new ApiError(500, "comment_create_failed", commentError.message);
    }

    await logActivity(supabase, {
      boardId: card.board_id,
      cardId: id,
      actorId: user.id,
      action: "comment_created",
      metadata: { commentId: comment.id },
    });

    const { data: assignees } = await supabase
      .from("card_assignees")
      .select("user_id")
      .eq("card_id", id);

    const uniqueTargets = new Set<string>();
    for (const assignee of assignees ?? []) {
      if (assignee.user_id !== user.id) {
        uniqueTargets.add(assignee.user_id);
      }
    }
    for (const mentionUserId of extractMentionedUserIds(payload.content)) {
      if (mentionUserId !== user.id) {
        uniqueTargets.add(mentionUserId);
      }
    }

    for (const targetUserId of uniqueTargets) {
      await createNotification(supabase, {
        userId: targetUserId,
        workspaceId: board.workspace_id,
        boardId: card.board_id,
        cardId: id,
        type: "comment",
        message: `カード「${card.title}」にコメントが追加されました。`,
        payload: { commentId: comment.id },
      });
    }

    return ok(comment, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
