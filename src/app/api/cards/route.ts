import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { createNotification, logActivity } from "@/lib/activity";
import { runAutomationForEvent } from "@/lib/automation/engine";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { ensurePosition } from "@/lib/utils";
import { cardCreateSchema } from "@/lib/validation/schemas";

const LOCATION_COLUMNS = ["location_name", "location_lat", "location_lng"] as const;

function hasMissingLocationColumnError(message: string | undefined) {
  if (!message?.includes("schema cache")) return false;
  return LOCATION_COLUMNS.some((column) => message.includes(`'${column}' column`));
}

function omitLocationColumns(payload: Record<string, unknown>) {
  const nextPayload = { ...payload };
  for (const column of LOCATION_COLUMNS) {
    delete nextPayload[column];
  }
  return nextPayload;
}

export async function POST(request: Request) {
  try {
    const payload = await parseBody(request, cardCreateSchema);
    const { supabase, user } = await requireApiUser();
    await assertBoardRole(supabase, payload.boardId, user.id, ["member"]);

    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("id, workspace_id")
      .eq("id", payload.boardId)
      .maybeSingle();
    if (boardError) {
      throw new ApiError(500, "board_lookup_failed", boardError.message);
    }
    if (!board) {
      throw new ApiError(404, "board_not_found", "Board not found.");
    }

    const insertPayload: Record<string, unknown> = {
      board_id: payload.boardId,
      list_id: payload.listId,
      title: payload.title,
      description: payload.description ?? null,
      position: ensurePosition(payload.position, Date.now()),
      due_at: payload.dueAt ?? null,
      priority: payload.priority ?? "medium",
      estimate_points: payload.estimatePoints ?? null,
      start_at: payload.startAt ?? null,
      created_by: user.id,
    };
    if (payload.locationName !== undefined) insertPayload.location_name = payload.locationName;
    if (payload.locationLat !== undefined) insertPayload.location_lat = payload.locationLat;
    if (payload.locationLng !== undefined) insertPayload.location_lng = payload.locationLng;

    let { data: card, error: cardError } = await supabase
      .from("cards")
      .insert(insertPayload)
      .select("*")
      .single();

    if (cardError && hasMissingLocationColumnError(cardError.message)) {
      const fallbackResult = await supabase
        .from("cards")
        .insert(omitLocationColumns(insertPayload))
        .select("*")
        .single();
      card = fallbackResult.data;
      cardError = fallbackResult.error;
    }

    if (cardError) {
      throw new ApiError(500, "card_create_failed", cardError.message);
    }

    if (payload.assigneeIds?.length) {
      const { error: assigneeError } = await supabase.from("card_assignees").insert(
        payload.assigneeIds.map((assigneeId) => ({
          card_id: card.id,
          user_id: assigneeId,
          assigned_by: user.id,
        })),
      );
      if (assigneeError) {
        throw new ApiError(500, "card_assignee_create_failed", assigneeError.message);
      }
    }

    if (payload.labelIds?.length) {
      const { error: labelError } = await supabase.from("card_labels").insert(
        payload.labelIds.map((labelId) => ({
          card_id: card.id,
          label_id: labelId,
        })),
      );
      if (labelError) {
        throw new ApiError(500, "card_label_create_failed", labelError.message);
      }
    }

    await logActivity(supabase, {
      boardId: payload.boardId,
      cardId: card.id,
      actorId: user.id,
      action: "card_created",
      metadata: {
        listId: payload.listId,
      },
    });

    for (const assigneeId of payload.assigneeIds ?? []) {
      if (assigneeId === user.id) {
        continue;
      }
      await createNotification(supabase, {
        userId: assigneeId,
        workspaceId: board.workspace_id,
        boardId: payload.boardId,
        cardId: card.id,
        type: "card_assigned",
        message: `You were assigned to card \"${payload.title}\".`,
      });
    }

    if (payload.labelIds?.length) {
      await runAutomationForEvent(supabase, {
        trigger: "label_added",
        workspaceId: board.workspace_id,
        boardId: payload.boardId,
        actorId: user.id,
        card: {
          id: card.id,
          board_id: card.board_id,
          list_id: card.list_id,
          priority: card.priority,
          due_at: card.due_at,
          labelIds: payload.labelIds,
          assigneeIds: payload.assigneeIds ?? [],
        },
      });
    }

    return ok(card, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
