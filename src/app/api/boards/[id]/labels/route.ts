import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";

const labelCreateSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().min(1).max(32).default("#64748b"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await parseBody(request, labelCreateSchema);
    const { supabase, user } = await requireApiUser();
    await assertBoardRole(supabase, id, user.id, ["member"]);

    const { data: label, error } = await supabase
      .from("labels")
      .insert({
        board_id: id,
        name: payload.name,
        color: payload.color,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (error) {
      throw new ApiError(500, "label_create_failed", error.message);
    }
    return ok(label, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
