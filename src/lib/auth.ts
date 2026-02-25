import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getServerAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    const isMissingSession =
      error.name === "AuthSessionMissingError" || error.message === "Auth session missing!";
    if (isMissingSession) {
      return { supabase, user: null };
    }
    throw new ApiError(401, "auth_error", error.message);
  }

  return { supabase, user };
}

export async function requireServerUser() {
  const auth = await getServerAuth();
  if (!auth.user) {
    redirect("/login");
  }
  return auth as { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; user: User };
}

export async function requireApiUser() {
  const auth = await getServerAuth();
  if (!auth.user) {
    throw new ApiError(401, "unauthorized", "ログインが必要です。");
  }
  return auth as { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; user: User };
}
