import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { parseBody } from "@/lib/api";
import { applyBoardTemplate, defaultBoardTemplatePayload } from "@/lib/templates";
import { ApiError, fail, ok, parseJsonSafely } from "@/lib/http";
import { assertWorkspaceRole } from "@/lib/permissions";
import { slugify } from "@/lib/utils";

const boardCreatePayloadSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
  templateId: z.uuid().nullable().optional(),
  visibility: z.enum(["private", "workspace", "public"]).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workspaceId } = await params;
    const payload = await parseBody(request, boardCreatePayloadSchema);
    const { supabase, user } = await requireApiUser();
    await assertWorkspaceRole(supabase, workspaceId, user.id, ["member"]);
    const slugBase = slugify(payload.name) || "board";

    const { data: board, error: boardError } = await supabase
      .from("boards")
      .insert({
        workspace_id: workspaceId,
        name: payload.name,
        slug: `${slugBase}-${crypto.randomUUID().slice(0, 6)}`,
        description: payload.description ?? null,
        color: payload.color ?? "#2563eb",
        visibility: payload.visibility ?? "private",
        created_by: user.id,
      })
      .select("*")
      .single();

    if (boardError) {
      throw new ApiError(500, "board_create_failed", boardError.message);
    }

    const { data: workspaceMembers, error: memberLookupError } = await supabase
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspaceId);

    if (memberLookupError) {
      throw new ApiError(500, "workspace_member_lookup_failed", memberLookupError.message);
    }

    if (workspaceMembers?.length) {
      const { error: boardMembersError } = await supabase.from("board_members").insert(
        workspaceMembers.map((member) => ({
          board_id: board.id,
          user_id: member.user_id,
          role: member.role === "workspace_admin" ? "board_admin" : "member",
        })),
      );
      if (boardMembersError) {
        throw new ApiError(500, "board_member_seed_failed", boardMembersError.message);
      }
    }

    let templatePayload = defaultBoardTemplatePayload();
    if (payload.templateId) {
      const { data: template, error: templateError } = await supabase
        .from("templates")
        .select("payload")
        .eq("id", payload.templateId)
        .maybeSingle();
      if (templateError) {
        throw new ApiError(500, "template_lookup_failed", templateError.message);
      }
      if (template?.payload) {
        templatePayload = parseJsonSafely(template.payload, templatePayload);
      }
    }
    await applyBoardTemplate(supabase, board.id, user.id, templatePayload);

    return ok(board, { status: 201 });
  } catch (error) {
    return fail(error as Error);
  }
}
