import type { SupabaseClient, User } from "@supabase/supabase-js";

import { ApiError } from "@/lib/http";

export async function ensureProfileForUser(supabase: SupabaseClient, user: User) {
  if (!user.email) {
    throw new ApiError(
      400,
      "profile_email_missing",
      "Authenticated user does not have an email. Cannot create profile row.",
    );
  }

  const metadataDisplayName =
    typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null;
  const displayName = metadataDisplayName?.trim() || user.email.split("@")[0];

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      display_name: displayName,
    },
    { onConflict: "id" },
  );
  if (error) {
    throw new ApiError(500, "profile_upsert_failed", error.message);
  }
}
