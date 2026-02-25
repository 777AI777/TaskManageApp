import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { attachmentCreateSchema } from "@/lib/validation/schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, attachmentCreateSchema);
    const { supabase, user } = await requireApiUser();

    const { data: card, error: cardLookupError } = await supabase
      .from("cards")
      .select("id, board_id")
      .eq("id", id)
      .maybeSingle();
    if (cardLookupError) {
      throw new ApiError(500, "card_lookup_failed", cardLookupError.message);
    }
    if (!card) {
      throw new ApiError(404, "card_not_found", "Cardが見つかりません。");
    }

    await assertBoardRole(supabase, card.board_id, user.id, ["member"]);

    const { data: attachment, error: attachmentError } = await supabase
      .from("attachments")
      .insert({
        card_id: id,
        uploader_id: user.id,
        name: payload.name,
        storage_path: payload.storagePath,
        mime_type: payload.mimeType,
        size_bytes: payload.sizeBytes,
        preview_url: payload.previewUrl ?? null,
      })
      .select("*")
      .single();

    if (attachmentError) {
      throw new ApiError(500, "attachment_create_failed", attachmentError.message);
    }

    await logActivity(supabase, {
      boardId: card.board_id,
      cardId: id,
      actorId: user.id,
      action: "attachment_added",
      metadata: { attachmentId: attachment.id, name: attachment.name },
    });

    return ok(attachment, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
