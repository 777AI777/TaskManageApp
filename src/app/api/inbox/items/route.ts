import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertWorkspaceRole } from "@/lib/permissions";
import { ensurePosition } from "@/lib/utils";
import { inboxItemCreateSchema, inboxItemPatchSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const boardId = searchParams.get("boardId");

    if (!workspaceId) {
      throw new ApiError(400, "missing_workspace", "workspaceId is required.");
    }

    await assertWorkspaceRole(supabase, workspaceId, user.id, ["member"]);

    let query = supabase
      .from("inbox_items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_archived", false)
      .order("position");

    if (boardId) {
      query = query.eq("board_id", boardId);
    }

    const { data, error } = await query;
    if (error) {
      throw new ApiError(500, "inbox_lookup_failed", error.message);
    }

    return ok(data ?? []);
  } catch (error) {
    return fail(error as Error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await parseBody(request, inboxItemCreateSchema);
    const { supabase, user } = await requireApiUser();
    await assertWorkspaceRole(supabase, payload.workspaceId, user.id, ["member"]);

    const position = ensurePosition(payload.position, Date.now());
    const { data, error } = await supabase
      .from("inbox_items")
      .insert({
        workspace_id: payload.workspaceId,
        board_id: payload.boardId ?? null,
        title: payload.title,
        description: payload.description ?? null,
        source_type: payload.sourceType,
        source_meta: payload.sourceMeta ?? {},
        position,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (error) {
      throw new ApiError(500, "inbox_create_failed", error.message);
    }

    if (data.board_id) {
      await logActivity(supabase, {
        boardId: data.board_id,
        actorId: user.id,
        action: "inbox_item_created",
        metadata: { inboxItemId: data.id },
      });
    }

    return ok(data, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await parseBody(request, inboxItemPatchSchema);
    const { supabase, user } = await requireApiUser();

    const { data: currentItem, error: itemLookupError } = await supabase
      .from("inbox_items")
      .select("id, workspace_id, board_id")
      .eq("id", payload.id)
      .maybeSingle();
    if (itemLookupError) {
      throw new ApiError(500, "inbox_lookup_failed", itemLookupError.message);
    }
    if (!currentItem) {
      throw new ApiError(404, "inbox_not_found", "Inbox item not found.");
    }

    await assertWorkspaceRole(supabase, currentItem.workspace_id, user.id, ["member"]);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.title !== undefined) updatePayload.title = payload.title;
    if (payload.description !== undefined) updatePayload.description = payload.description;
    if (payload.isArchived !== undefined) updatePayload.is_archived = payload.isArchived;
    if (payload.position !== undefined) updatePayload.position = payload.position;

    const { data, error } = await supabase
      .from("inbox_items")
      .update(updatePayload)
      .eq("id", payload.id)
      .select("*")
      .single();
    if (error) {
      throw new ApiError(500, "inbox_update_failed", error.message);
    }

    if (currentItem.board_id) {
      await logActivity(supabase, {
        boardId: currentItem.board_id,
        actorId: user.id,
        action: "inbox_item_updated",
        metadata: { inboxItemId: payload.id },
      });
    }

    return ok(data);
  } catch (error) {
    return fail(error as Error);
  }
}
