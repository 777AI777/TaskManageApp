import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { customFieldPatchSchema } from "@/lib/validation/schemas";

async function resolveCustomField(
  supabase: Awaited<ReturnType<typeof requireApiUser>>["supabase"],
  fieldId: string,
) {
  const { data, error } = await supabase
    .from("custom_fields")
    .select("*")
    .eq("id", fieldId)
    .maybeSingle();
  if (error) {
    throw new ApiError(500, "custom_field_lookup_failed", error.message);
  }
  if (!data) {
    throw new ApiError(404, "custom_field_not_found", "Custom field not found.");
  }
  return data;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  try {
    const { id: boardId, fieldId } = await params;
    const payload = await parseBody(request, customFieldPatchSchema);
    const { supabase, user } = await requireApiUser();

    const existing = await resolveCustomField(supabase, fieldId);
    if (existing.board_id !== boardId) {
      throw new ApiError(400, "custom_field_board_mismatch", "Board and custom field mismatch.");
    }
    await assertBoardRole(supabase, boardId, user.id, ["board_admin"]);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.name !== undefined) updatePayload.name = payload.name;
    if (payload.fieldType !== undefined) updatePayload.field_type = payload.fieldType;
    if (payload.options !== undefined) updatePayload.options = payload.options;
    if (payload.position !== undefined) updatePayload.position = payload.position;

    if (payload.fieldType && payload.fieldType !== "select" && payload.options === undefined) {
      updatePayload.options = [];
    }

    const { data, error } = await supabase
      .from("custom_fields")
      .update(updatePayload)
      .eq("id", fieldId)
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, "custom_field_update_failed", error.message);
    }

    await logActivity(supabase, {
      boardId,
      actorId: user.id,
      action: "custom_field_updated",
      metadata: {
        customFieldId: fieldId,
        patch: payload,
      },
    });

    return ok(data);
  } catch (error) {
    return fail(error as Error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fieldId: string }> },
) {
  try {
    const { id: boardId, fieldId } = await params;
    const { supabase, user } = await requireApiUser();

    const existing = await resolveCustomField(supabase, fieldId);
    if (existing.board_id !== boardId) {
      throw new ApiError(400, "custom_field_board_mismatch", "Board and custom field mismatch.");
    }
    await assertBoardRole(supabase, boardId, user.id, ["board_admin"]);

    const { error } = await supabase.from("custom_fields").delete().eq("id", fieldId);
    if (error) {
      throw new ApiError(500, "custom_field_delete_failed", error.message);
    }

    await logActivity(supabase, {
      boardId,
      actorId: user.id,
      action: "custom_field_deleted",
      metadata: {
        customFieldId: fieldId,
        name: existing.name,
      },
    });

    return ok({ id: fieldId, deleted: true });
  } catch (error) {
    return fail(error as Error);
  }
}
