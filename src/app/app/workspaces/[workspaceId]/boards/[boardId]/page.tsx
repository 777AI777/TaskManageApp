import { notFound } from "next/navigation";

import { BoardClient } from "@/components/board/board-client";
import type { BoardDataBundle } from "@/components/board/board-types";
import { requireServerUser } from "@/lib/auth";
import { assertBoardRole } from "@/lib/permissions";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  const { supabase, user } = await requireServerUser();
  await assertBoardRole(supabase, boardId, user.id, ["member"]);

  const [{ data: workspace }, { data: board }] = await Promise.all([
    supabase.from("workspaces").select("id, name").eq("id", workspaceId).maybeSingle(),
    supabase.from("boards").select("id, name, description, color").eq("id", boardId).maybeSingle(),
  ]);

  if (!workspace || !board) {
    notFound();
  }

  const [
    { data: lists },
    { data: cards },
    { data: labels },
    { data: boardMembers },
    { data: activities },
  ] = await Promise.all([
    supabase.from("lists").select("*").eq("board_id", boardId).eq("is_archived", false).order("position"),
    supabase.from("cards").select("*").eq("board_id", boardId).eq("archived", false).order("position"),
    supabase.from("labels").select("*").eq("board_id", boardId),
    supabase.from("board_members").select("user_id, role").eq("board_id", boardId),
    supabase.from("activities").select("*").eq("board_id", boardId).order("created_at", { ascending: false }),
  ]);

  const cardIds = (cards ?? []).map((card) => card.id);
  const boardUserIds = (boardMembers ?? []).map((member) => member.user_id);

  const [{ data: profiles }, { data: cardAssignees }, { data: cardLabels }, { data: comments }, { data: checklists }, { data: attachments }] =
    await Promise.all([
      boardUserIds.length
        ? supabase.from("profiles").select("id, display_name, email, avatar_url").in("id", boardUserIds)
        : Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null; email: string | null; avatar_url: string | null }> }),
      cardIds.length
        ? supabase.from("card_assignees").select("card_id, user_id").in("card_id", cardIds)
        : Promise.resolve({ data: [] as Array<{ card_id: string; user_id: string }> }),
      cardIds.length
        ? supabase.from("card_labels").select("card_id, label_id").in("card_id", cardIds)
        : Promise.resolve({ data: [] as Array<{ card_id: string; label_id: string }> }),
      cardIds.length
        ? supabase.from("comments").select("*").in("card_id", cardIds).order("created_at")
        : Promise.resolve({ data: [] as Array<Record<string, never>> }),
      cardIds.length
        ? supabase.from("checklists").select("*").in("card_id", cardIds).order("position")
        : Promise.resolve({ data: [] as Array<Record<string, never>> }),
      cardIds.length
        ? supabase.from("attachments").select("*").in("card_id", cardIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Array<Record<string, never>> }),
    ]);

  const checklistIds = (checklists ?? []).map((checklist) => checklist.id);
  const { data: checklistItems } = checklistIds.length
    ? await supabase.from("checklist_items").select("*").in("checklist_id", checklistIds).order("position")
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const initialData: BoardDataBundle = {
    workspace: {
      id: workspace.id,
      name: workspace.name,
    },
    board: {
      id: board.id,
      name: board.name,
      description: board.description,
      color: board.color,
    },
    lists: (lists ?? []) as BoardDataBundle["lists"],
    cards: (cards ?? []) as BoardDataBundle["cards"],
    labels: (labels ?? []) as BoardDataBundle["labels"],
    members: (boardMembers ?? []).map((member) => ({
      user_id: member.user_id,
      role: member.role,
      profile: profileMap.get(member.user_id) ?? null,
    })),
    cardAssignees: (cardAssignees ?? []) as BoardDataBundle["cardAssignees"],
    cardLabels: (cardLabels ?? []) as BoardDataBundle["cardLabels"],
    comments: (comments ?? []) as BoardDataBundle["comments"],
    checklists: (checklists ?? []) as BoardDataBundle["checklists"],
    checklistItems: (checklistItems ?? []) as BoardDataBundle["checklistItems"],
    attachments: (attachments ?? []) as BoardDataBundle["attachments"],
    activities: (activities ?? []) as BoardDataBundle["activities"],
  };

  return <BoardClient initialData={initialData} />;
}
