import type { SupabaseClient } from "@supabase/supabase-js";

type ActivityInput = {
  boardId: string;
  cardId?: string | null;
  actorId: string;
  action: string;
  metadata?: Record<string, unknown>;
};

type NotificationInput = {
  userId: string;
  workspaceId: string;
  boardId?: string | null;
  cardId?: string | null;
  type: string;
  message: string;
  payload?: Record<string, unknown>;
};

export async function logActivity(supabase: SupabaseClient, input: ActivityInput) {
  const payload = {
    board_id: input.boardId,
    card_id: input.cardId ?? null,
    actor_id: input.actorId,
  };
  const metadata = input.metadata ?? {};

  await Promise.all([
    supabase.from("activities").insert({
      ...payload,
      action: input.action,
      metadata,
    }),
    supabase.from("card_activity").insert({
      ...payload,
      action_type: input.action,
      payload: metadata,
    }),
  ]);
}

export async function createNotification(
  _supabase: SupabaseClient,
  _input: NotificationInput,
) {
  // Notification feature is temporarily disabled.
  return;
}
