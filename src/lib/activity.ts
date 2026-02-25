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
  await supabase.from("activities").insert({
    board_id: input.boardId,
    card_id: input.cardId ?? null,
    actor_id: input.actorId,
    action: input.action,
    metadata: input.metadata ?? {},
  });
}

export async function createNotification(
  supabase: SupabaseClient,
  input: NotificationInput,
) {
  await supabase.from("notifications").insert({
    user_id: input.userId,
    workspace_id: input.workspaceId,
    board_id: input.boardId ?? null,
    card_id: input.cardId ?? null,
    type: input.type,
    message: input.message,
    payload: input.payload ?? {},
  });
}
