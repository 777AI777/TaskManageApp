import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";

export async function POST() {
  try {
    const { supabase, user } = await requireApiUser();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) {
      throw new ApiError(500, "notification_mark_all_read_failed", error.message);
    }
    return ok({ success: true });
  } catch (error) {
    return fail(error as Error);
  }
}
