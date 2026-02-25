import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get("attachmentId");
    if (!attachmentId) {
      throw new ApiError(400, "missing_attachment_id", "attachmentIdは必須です。");
    }

    const { supabase, user } = await requireApiUser();
    const { data: attachment, error: attachmentError } = await supabase
      .from("attachments")
      .select("id, storage_path, card_id")
      .eq("id", attachmentId)
      .maybeSingle();
    if (attachmentError) {
      throw new ApiError(500, "attachment_lookup_failed", attachmentError.message);
    }
    if (!attachment) {
      throw new ApiError(404, "attachment_not_found", "添付ファイルが見つかりません。");
    }

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("board_id")
      .eq("id", attachment.card_id)
      .maybeSingle();
    if (cardError) {
      throw new ApiError(500, "card_lookup_failed", cardError.message);
    }
    if (!card) {
      throw new ApiError(404, "card_not_found", "カードが見つかりません。");
    }

    await assertBoardRole(supabase, card.board_id, user.id, ["member"]);

    const { data: signed, error: signError } = await supabase.storage
      .from("attachments")
      .createSignedUrl(attachment.storage_path, 60 * 30);
    if (signError) {
      throw new ApiError(500, "attachment_sign_failed", signError.message);
    }
    return ok({ signedUrl: signed.signedUrl, expiresIn: 1800 });
  } catch (error) {
    return fail(error as Error);
  }
}
