import { notFound, redirect } from "next/navigation";

import { BoardClient } from "@/components/board/board-client";
import type { BoardDataBundle } from "@/components/board/board-types";
import { getServerAuth } from "@/lib/auth";
import { resolveBoardRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function BoardCardPage({
  params,
}: {
  params: Promise<{ slug: string; cardId: string }>;
}) {
  const { slug, cardId } = await params;
  const { supabase, user } = await getServerAuth();
  const nextPath = `/b/${slug}/c/${cardId}`;
  const loginPath = `/login?next=${encodeURIComponent(nextPath)}`;

  if (!user) {
    redirect(loginPath);
  }

  const { data: board } = await supabase
    .from("boards")
    .select("id, workspace_id, name, slug, description, color, visibility")
    .eq("slug", slug)
    .eq("is_archived", false)
    .maybeSingle();

  if (!board) {
    notFound();
  }

  const role = await resolveBoardRole(supabase, board.id, user.id);
  if (!role) {
    redirect("/u/me/boards");
  }

  const { data: card } = await supabase
    .from("cards")
    .select("id")
    .eq("id", cardId)
    .eq("board_id", board.id)
    .eq("archived", false)
    .maybeSingle();

  if (!card) {
    notFound();
  }

  const initialData = await getPrivateBoardBundle({
    supabase,
    boardId: board.id,
    workspaceId: board.workspace_id,
    currentUserId: user.id,
    currentUserEmail: user.email ?? null,
    currentUserDisplayName:
      typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null,
    role,
  });

  return <BoardClient initialData={initialData} initialCardId={card.id} />;
}

async function getPrivateBoardBundle({
  supabase,
  boardId,
  workspaceId,
  currentUserId,
  currentUserEmail,
  currentUserDisplayName,
  role,
}: {
  supabase: Awaited<ReturnType<typeof getServerAuth>>["supabase"];
  boardId: string;
  workspaceId: string;
  currentUserId: string;
  currentUserEmail: string | null;
  currentUserDisplayName: string | null;
  role: "workspace_admin" | "board_admin" | "member";
}): Promise<BoardDataBundle> {
  const [
    { data: workspace },
    { data: board },
    { data: workspaceBoards },
  ] = await Promise.all([
    supabase.from("workspaces").select("id, name, slug").eq("id", workspaceId).maybeSingle(),
    supabase
      .from("boards")
      .select("id, name, slug, description, color, visibility, dashboard_tiles")
      .eq("id", boardId)
      .eq("is_archived", false)
      .maybeSingle(),
    supabase
      .from("boards")
      .select("id, name, slug, description, color, is_archived")
      .eq("workspace_id", workspaceId)
      .eq("is_archived", false)
      .order("created_at"),
  ]);

  if (!workspace || !board) {
    notFound();
  }

  const [
    { data: lists },
    { data: cards },
    { data: labels },
    { data: boardMembers },
    { data: preferences },
    { data: customFields },
  ] = await Promise.all([
    supabase.from("lists").select("*").eq("board_id", boardId).eq("is_archived", false).order("position"),
    supabase.from("cards").select("*").eq("board_id", boardId).eq("archived", false).order("position"),
    supabase.from("labels").select("*").eq("board_id", boardId),
    supabase.from("board_members").select("user_id, role").eq("board_id", boardId),
    supabase
      .from("user_board_preferences")
      .select("*")
      .eq("board_id", boardId)
      .eq("user_id", currentUserId)
      .maybeSingle(),
    supabase.from("custom_fields").select("*").eq("board_id", boardId).order("position"),
  ]);

  const cardIds = (cards ?? []).map((value) => value.id);
  const boardUserIds = Array.from(
    new Set([...(boardMembers ?? []).map((member) => member.user_id), currentUserId]),
  );

  const [
    { data: profiles },
    { data: cardAssignees },
    { data: cardLabels },
  ] = await Promise.all([
    boardUserIds.length
      ? supabase
          .from("profiles")
          .select("id, display_name, email, avatar_url, avatar_color")
          .in("id", boardUserIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            display_name: string | null;
            email: string | null;
            avatar_url: string | null;
            avatar_color: string | null;
          }>,
        }),
    cardIds.length
      ? supabase.from("card_assignees").select("card_id, user_id").in("card_id", cardIds)
      : Promise.resolve({ data: [] as Array<{ card_id: string; user_id: string }> }),
    cardIds.length
      ? supabase.from("card_labels").select("card_id, label_id").in("card_id", cardIds)
      : Promise.resolve({ data: [] as Array<{ card_id: string; label_id: string }> }),
  ]);

  const customFieldIds = (customFields ?? []).map((field) => field.id);
  const { data: cardCustomFieldValues } = cardIds.length && customFieldIds.length
    ? await supabase
        .from("card_custom_field_values")
        .select("*")
        .in("card_id", cardIds)
        .in("custom_field_id", customFieldIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    },
    workspaceBoards: (workspaceBoards ?? []) as BoardDataBundle["workspaceBoards"],
    currentUser: {
      id: currentUserId,
      email: currentUserEmail,
      display_name: currentUserDisplayName,
      avatar_color: profileMap.get(currentUserId)?.avatar_color ?? null,
      role,
    },
    board: {
      id: board.id,
      name: board.name,
      slug: board.slug,
      description: board.description,
      color: board.color,
      visibility: board.visibility,
      dashboard_tiles: (board.dashboard_tiles ?? []) as BoardDataBundle["board"]["dashboard_tiles"],
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
    customFields: (customFields ?? []) as BoardDataBundle["customFields"],
    cardCustomFieldValues: (cardCustomFieldValues ?? []) as BoardDataBundle["cardCustomFieldValues"],
    preferences: (preferences ?? null) as BoardDataBundle["preferences"],
  };
}
