import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_BOARD_LISTS } from "@/lib/constants";
import { ApiError } from "@/lib/http";

export function defaultBoardTemplatePayload() {
  return {
    lists: DEFAULT_BOARD_LISTS.map((item) => ({
      name: item.name,
      position: item.position,
    })),
  };
}

export async function applyBoardTemplate(
  supabase: SupabaseClient,
  boardId: string,
  createdBy: string,
  templatePayload?: { lists?: Array<{ name: string; position: number }> } | null,
) {
  const lists = templatePayload?.lists?.length ? templatePayload.lists : DEFAULT_BOARD_LISTS;

  const { error } = await supabase.from("lists").insert(
    lists.map((list, index) => ({
      board_id: boardId,
      name: list.name,
      position: list.position ?? (index + 1) * 1000,
      created_by: createdBy,
    })),
  );

  if (error) {
    throw new ApiError(500, "list_seed_failed", error.message);
  }
}
