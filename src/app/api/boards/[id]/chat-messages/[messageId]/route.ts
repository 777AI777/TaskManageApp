import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const { id: boardId, messageId } = await params;
    const { supabase, user } = await requireApiUser();

    await assertBoardRole(supabase, boardId, user.id, ["member"]);

    const { data: message, error: lookupError } = await supabase
      .from("board_chat_messages")
      .select("id, board_id, user_id")
      .eq("id", messageId)
      .eq("board_id", boardId)
      .maybeSingle();

    if (lookupError) {
      throw new ApiError(500, "board_chat_message_lookup_failed", lookupError.message);
    }
    if (!message) {
      throw new ApiError(404, "board_chat_message_not_found", "Board chat message not found.");
    }
    if (message.user_id !== user.id) {
      throw new ApiError(403, "board_chat_message_forbidden", "Only the message author can delete this message.");
    }

    const { error: deleteError } = await supabase
      .from("board_chat_messages")
      .delete()
      .eq("id", messageId)
      .eq("board_id", boardId);

    if (deleteError) {
      throw new ApiError(500, "board_chat_message_delete_failed", deleteError.message);
    }

    return ok({ id: messageId, deleted: true });
  } catch (error) {
    return fail(error as Error);
  }
}
