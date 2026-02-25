import { addDays } from "date-fns";

import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { ApiError, fail, ok } from "@/lib/http";
import { assertWorkspaceRole } from "@/lib/permissions";
import { randomToken } from "@/lib/utils";
import { inviteSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const payload = await parseBody(request, inviteSchema);
    const { supabase, user } = await requireApiUser();
    await assertWorkspaceRole(supabase, payload.workspaceId, user.id, ["workspace_admin"]);

    const token = randomToken();
    const expiresAt = addDays(new Date(), 7).toISOString();
    const { data, error } = await supabase
      .from("invites")
      .insert({
        workspace_id: payload.workspaceId,
        email: payload.email.toLowerCase(),
        role: payload.role,
        token,
        status: "pending",
        inviter_id: user.id,
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, "invite_create_failed", error.message);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = new URL(`/invite/${token}`, appUrl).toString();

    return ok({
      invite: data,
      inviteUrl,
      note: "メール送信連携は未実装です。戻り値のinviteUrlを共有してください。",
    });
  } catch (error) {
    return fail(error as Error);
  }
}
