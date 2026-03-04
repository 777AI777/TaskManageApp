import type { SupabaseClient } from "@supabase/supabase-js";

type NotificationInput = {
  userId: string;
  workspaceId: string;
  boardId?: string | null;
  cardId?: string | null;
  type: string;
  message: string;
  payload?: Record<string, unknown>;
};

export async function createNotification(
  _supabase: SupabaseClient,
  _input: NotificationInput,
) {
  // Notification feature is temporarily disabled.
  return;
}
