import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";
import { customFieldCreateSchema } from "@/lib/validation/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: boardId } = await params;
    const { supabase, user } = await requireApiUser();
    await assertBoardRole(supabase, boardId, user.id, ["member"]);

    const { data, error } = await supabase
      .from("custom_fields")
      .select("*")
      .eq("board_id", boardId)
      .order("position");

    if (error) {
      throw new ApiError(500, "custom_fields_lookup_failed", error.message);
    }

    return ok(data ?? []);
  } catch (error) {
    return fail(error as Error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: boardId } = await params;
    const payload = await parseBody(request, customFieldCreateSchema);
    const { supabase, user } = await requireApiUser();
    await assertBoardRole(supabase, boardId, user.id, ["board_admin"]);

    const { data, error } = await supabase
      .from("custom_fields")
      .insert({
        board_id: boardId,
        name: payload.name,
        field_type: payload.fieldType,
        options: payload.fieldType === "select" ? payload.options : [],
        position: payload.position ?? Date.now(),
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, "custom_field_create_failed", error.message);
    }

    await logActivity(supabase, {
      boardId,
      actorId: user.id,
      action: "custom_field_created",
      metadata: {
        customFieldId: data.id,
        name: data.name,
        fieldType: data.field_type,
      },
    });

    return ok(data, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
