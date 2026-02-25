import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "50");

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50);

    if (error) {
      throw new ApiError(500, "notification_lookup_failed", error.message);
    }
    return ok(data ?? []);
  } catch (error) {
    return fail(error as Error);
  }
}
