import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireApiUser();

    const { data, error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) {
      throw new ApiError(500, "notification_mark_read_failed", error.message);
    }

    return ok(data);
  } catch (error) {
    return fail(error as Error);
  }
}
