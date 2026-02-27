import { notFound, redirect } from "next/navigation";

import { BoardClient } from "@/components/board/board-client";
import type { BoardDataBundle } from "@/components/board/board-types";
import { PublicBoardClient } from "@/components/public/public-board-client";
import { getServerAuth } from "@/lib/auth";
import { resolveBoardRole } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { supabase, user } = await getServerAuth();
  const nextPath = `/b/${slug}`;
  const loginPath = `/login?next=${encodeURIComponent(nextPath)}`;

  const { data: visibleBoard } = await supabase
    .from("boards")
    .select("id, workspace_id, name, slug, description, color, visibility")
    .eq("slug", slug)
    .eq("is_archived", false)
    .maybeSingle();

  let board = visibleBoard;
  if (!board && !user) {
    try {
      const admin = createSupabaseAdminClient();
      const { data: hiddenBoard, error: hiddenBoardError } = await admin
        .from("boards")
        .select("id, workspace_id, name, slug, description, color, visibility")
        .eq("slug", slug)
        .eq("is_archived", false)
        .maybeSingle();

      if (hiddenBoardError) {
        redirect(loginPath);
      }

      if (!hiddenBoard) {
        notFound();
      }

      if (hiddenBoard.visibility !== "public") {
        redirect(loginPath);
      }

      board = hiddenBoard;
    } catch {
      redirect(loginPath);
    }
  }

  if (!board) {
    if (user) {
      redirect("/u/me/boards");
    }
    notFound();
  }

  const role = user ? await resolveBoardRole(supabase, board.id, user.id) : null;
  const hasBoardAccess = Boolean(role);

  if (!hasBoardAccess && board.visibility !== "public") {
    if (!user) {
      redirect(loginPath);
    }
    redirect("/u/me/boards");
  }

  if (!hasBoardAccess) {
    const publicBundle = await getPublicBoardBundle(supabase, board.id);
    return (
      <PublicBoardClient
        board={{
          id: board.id,
          name: board.name,
          slug: board.slug,
          description: board.description,
        }}
        lists={publicBundle.lists}
        cards={publicBundle.cards}
        labels={publicBundle.labels}
        cardLabels={publicBundle.cardLabels}
        comments={publicBundle.comments}
        checklists={publicBundle.checklists}
        checklistItems={publicBundle.checklistItems}
        attachments={publicBundle.attachments}
        activities={publicBundle.activities}
        customFields={publicBundle.customFields}
        cardCustomFieldValues={publicBundle.cardCustomFieldValues}
      />
    );
  }

  if (!user) {
    redirect(loginPath);
  }
  if (!role) {
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

  return <BoardClient initialData={initialData} />;
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

  const cardIds = (cards ?? []).map((card) => card.id);
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

async function getPublicBoardBundle(
  supabase: Awaited<ReturnType<typeof getServerAuth>>["supabase"],
  boardId: string,
) {
  const [{ data: lists }, { data: cards }, { data: labels }, { data: customFields }, { data: activities }] =
    await Promise.all([
      supabase
        .from("lists")
        .select("id, name, position")
        .eq("board_id", boardId)
        .eq("is_archived", false)
        .order("position"),
      supabase
        .from("cards")
        .select("id, list_id, title, description, position, due_at, start_at, is_completed")
        .eq("board_id", boardId)
        .eq("archived", false)
        .order("position"),
      supabase.from("labels").select("id, name, color").eq("board_id", boardId),
      supabase.from("custom_fields").select("id, name, field_type, options, position").eq("board_id", boardId),
      supabase
        .from("activities")
        .select("id, card_id, action, created_at")
        .eq("board_id", boardId)
        .order("created_at", { ascending: false }),
    ]);

  const cardIds = (cards ?? []).map((card) => card.id);
  const checklistQuery = cardIds.length
    ? supabase.from("checklists").select("id, card_id, title, position").in("card_id", cardIds)
    : Promise.resolve({ data: [] as Array<{ id: string; card_id: string; title: string; position: number }> });
  const commentsQuery = cardIds.length
    ? supabase
        .from("comments")
        .select("id, card_id, content, created_at")
        .in("card_id", cardIds)
        .order("created_at")
    : Promise.resolve({ data: [] as Array<{ id: string; card_id: string; content: string; created_at: string }> });
  const attachmentsQuery = cardIds.length
    ? supabase
        .from("attachments")
        .select("id, card_id, name, mime_type, size_bytes, created_at")
        .in("card_id", cardIds)
    : Promise.resolve({
        data: [] as Array<{
          id: string;
          card_id: string;
          name: string;
          mime_type: string;
          size_bytes: number;
          created_at: string;
        }>,
      });
  const cardLabelsQuery = cardIds.length
    ? supabase.from("card_labels").select("card_id, label_id").in("card_id", cardIds)
    : Promise.resolve({ data: [] as Array<{ card_id: string; label_id: string }> });

  const [{ data: checklists }, { data: comments }, { data: attachments }, { data: cardLabels }] =
    await Promise.all([checklistQuery, commentsQuery, attachmentsQuery, cardLabelsQuery]);

  const checklistIds = (checklists ?? []).map((checklist) => checklist.id);
  const customFieldIds = (customFields ?? []).map((field) => field.id);
  const checklistItemsQuery = checklistIds.length
    ? supabase
        .from("checklist_items")
        .select("id, checklist_id, content, is_completed, position")
        .in("checklist_id", checklistIds)
    : Promise.resolve({
        data: [] as Array<{
          id: string;
          checklist_id: string;
          content: string;
          is_completed: boolean;
          position: number;
        }>,
      });
  const customFieldValuesQuery = customFieldIds.length && cardIds.length
    ? supabase
        .from("card_custom_field_values")
        .select("id, card_id, custom_field_id, value_text, value_number, value_date, value_boolean, value_option")
        .in("custom_field_id", customFieldIds)
        .in("card_id", cardIds)
    : Promise.resolve({
        data: [] as Array<{
          id: string;
          card_id: string;
          custom_field_id: string;
          value_text: string | null;
          value_number: number | null;
          value_date: string | null;
          value_boolean: boolean | null;
          value_option: string | null;
        }>,
      });

  const [{ data: checklistItems }, { data: cardCustomFieldValues }] = await Promise.all([
    checklistItemsQuery,
    customFieldValuesQuery,
  ]);

  return {
    lists: lists ?? [],
    cards: cards ?? [],
    labels: labels ?? [],
    customFields: customFields ?? [],
    activities: activities ?? [],
    checklists: checklists ?? [],
    comments: comments ?? [],
    attachments: attachments ?? [],
    cardLabels: cardLabels ?? [],
    checklistItems: checklistItems ?? [],
    cardCustomFieldValues: cardCustomFieldValues ?? [],
  };
}
