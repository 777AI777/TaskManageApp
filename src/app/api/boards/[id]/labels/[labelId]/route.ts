import { z } from "zod";

import { parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { ApiError, fail, ok } from "@/lib/http";
import { assertBoardRole } from "@/lib/permissions";

const labelUpdateSchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    color: z.string().min(1).max(32).optional(),
  })
  .refine((payload) => payload.name !== undefined || payload.color !== undefined, {
    message: "Either name or color is required.",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; labelId: string }> },
) {
  try {
    const { id, labelId } = await params;
    const payload = await parseBody(request, labelUpdateSchema);
    const { supabase, user } = await requireApiUser();
    await assertBoardRole(supabase, id, user.id, ["member"]);

    const updates: { name?: string; color?: string } = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.color !== undefined) updates.color = payload.color;

    const { data: updatedLabel, error } = await supabase
      .from("labels")
      .update(updates)
      .eq("board_id", id)
      .eq("id", labelId)
      .select("*")
      .single();
    if (error) {
      throw new ApiError(500, "label_update_failed", error.message);
    }

    return ok(updatedLabel);
  } catch (error) {
    return fail(error as Error);
  }
}

