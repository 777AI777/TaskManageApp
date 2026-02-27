import { requireApiUser } from "@/lib/auth";
import { ApiError, fail } from "@/lib/http";
import { assertWorkspaceRole } from "@/lib/permissions";

type TableRows = Array<Record<string, unknown>>;

function toStringId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function collectIds(rows: TableRows, fields: string[]): string[] {
  const result = new Set<string>();
  rows.forEach((row) => {
    fields.forEach((field) => {
      const id = toStringId(row[field]);
      if (id) {
        result.add(id);
      }
    });
  });
  return Array.from(result);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workspaceId } = await params;
    const { supabase, user } = await requireApiUser();
    await assertWorkspaceRole(supabase, workspaceId, user.id, ["member"]);

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .maybeSingle();
    if (workspaceError) {
      throw new ApiError(500, "workspace_lookup_failed", workspaceError.message);
    }
    if (!workspace) {
      throw new ApiError(404, "workspace_not_found", "Workspaceが見つかりません。");
    }

    const [{ data: workspaceMembers, error: workspaceMembersError }, { data: boards, error: boardsError }] =
      await Promise.all([
        supabase
          .from("workspace_members")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("joined_at", { ascending: true }),
        supabase
          .from("boards")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: true }),
      ]);
    if (workspaceMembersError) {
      throw new ApiError(500, "workspace_member_lookup_failed", workspaceMembersError.message);
    }
    if (boardsError) {
      throw new ApiError(500, "board_lookup_failed", boardsError.message);
    }

    const boardIds = (boards ?? [])
      .map((board) => toStringId(board.id))
      .filter((id): id is string => Boolean(id));

    const [
      { data: boardMembers, error: boardMembersError },
      { data: lists, error: listsError },
      { data: cards, error: cardsError },
      { data: labels, error: labelsError },
      { data: boardPowerUps, error: boardPowerUpsError },
      { data: activities, error: activitiesError },
      { data: customFields, error: customFieldsError },
    ] = boardIds.length
      ? await Promise.all([
          supabase.from("board_members").select("*").in("board_id", boardIds),
          supabase.from("lists").select("*").in("board_id", boardIds),
          supabase.from("cards").select("*").in("board_id", boardIds),
          supabase.from("labels").select("*").in("board_id", boardIds),
          supabase.from("board_power_ups").select("*").in("board_id", boardIds),
          supabase
            .from("activities")
            .select("*")
            .in("board_id", boardIds)
            .order("created_at", { ascending: false }),
          supabase.from("custom_fields").select("*").in("board_id", boardIds),
        ])
      : [
          { data: [] as TableRows, error: null },
          { data: [] as TableRows, error: null },
          { data: [] as TableRows, error: null },
          { data: [] as TableRows, error: null },
          { data: [] as TableRows, error: null },
          { data: [] as TableRows, error: null },
          { data: [] as TableRows, error: null },
        ];

    if (boardMembersError) {
      throw new ApiError(500, "board_member_lookup_failed", boardMembersError.message);
    }
    if (listsError) {
      throw new ApiError(500, "list_lookup_failed", listsError.message);
    }
    if (cardsError) {
      throw new ApiError(500, "card_lookup_failed", cardsError.message);
    }
    if (labelsError) {
      throw new ApiError(500, "label_lookup_failed", labelsError.message);
    }
    if (boardPowerUpsError) {
      throw new ApiError(500, "power_up_lookup_failed", boardPowerUpsError.message);
    }
    if (activitiesError) {
      throw new ApiError(500, "activity_lookup_failed", activitiesError.message);
    }
    if (customFieldsError) {
      throw new ApiError(500, "custom_field_lookup_failed", customFieldsError.message);
    }

    const cardIds = (cards ?? [])
      .map((card) => toStringId(card.id))
      .filter((id): id is string => Boolean(id));
    const checklistIds: string[] = [];
    const customFieldIds = (customFields ?? [])
      .map((field) => toStringId(field.id))
      .filter((id): id is string => Boolean(id));
    const labelIds = (labels ?? [])
      .map((label) => toStringId(label.id))
      .filter((id): id is string => Boolean(id));

    const [
      { data: cardLabels, error: cardLabelsError },
      { data: cardAssignees, error: cardAssigneesError },
      { data: cardWatchers, error: cardWatchersError },
      { data: checklists, error: checklistsError },
      { data: comments, error: commentsError },
      { data: attachments, error: attachmentsError },
    ] = cardIds.length
      ? await Promise.all([
          labelIds.length ? supabase.from("card_labels").select("*").in("label_id", labelIds) : Promise.resolve({ data: [] as TableRows, error: null }),
          supabase.from("card_assignees").select("*").in("card_id", cardIds),
          supabase.from("card_watchers").select("*").in("card_id", cardIds),
          supabase.from("checklists").select("*").in("card_id", cardIds),
          supabase.from("comments").select("*").in("card_id", cardIds),
          supabase.from("attachments").select("*").in("card_id", cardIds),
        ])
      : [
          { data: [] as TableRows, error: null },
          { data: [] as TableRows, error: null },
          { data: [] as TableRows, error: null },
          { data: [] as TableRows, error: null },
          { data: [] as TableRows, error: null },
          { data: [] as TableRows, error: null },
        ];

    if (cardLabelsError) {
      throw new ApiError(500, "card_label_lookup_failed", cardLabelsError.message);
    }
    if (cardAssigneesError) {
      throw new ApiError(500, "card_assignee_lookup_failed", cardAssigneesError.message);
    }
    if (cardWatchersError) {
      throw new ApiError(500, "card_watcher_lookup_failed", cardWatchersError.message);
    }
    if (checklistsError) {
      throw new ApiError(500, "checklist_lookup_failed", checklistsError.message);
    }
    if (commentsError) {
      throw new ApiError(500, "comment_lookup_failed", commentsError.message);
    }
    if (attachmentsError) {
      throw new ApiError(500, "attachment_lookup_failed", attachmentsError.message);
    }

    (checklists ?? []).forEach((checklist) => {
      const checklistId = toStringId(checklist.id);
      if (checklistId) {
        checklistIds.push(checklistId);
      }
    });

    const [{ data: checklistItems, error: checklistItemsError }, { data: cardCustomFieldValues, error: cardCustomFieldValuesError }] =
      await Promise.all([
        checklistIds.length
          ? supabase.from("checklist_items").select("*").in("checklist_id", checklistIds)
          : Promise.resolve({ data: [] as TableRows, error: null }),
        cardIds.length && customFieldIds.length
          ? supabase
              .from("card_custom_field_values")
              .select("*")
              .in("card_id", cardIds)
              .in("custom_field_id", customFieldIds)
          : Promise.resolve({ data: [] as TableRows, error: null }),
      ]);

    if (checklistItemsError) {
      throw new ApiError(500, "checklist_item_lookup_failed", checklistItemsError.message);
    }
    if (cardCustomFieldValuesError) {
      throw new ApiError(500, "card_custom_field_value_lookup_failed", cardCustomFieldValuesError.message);
    }

    const referencedUserIds = new Set<string>();
    const allRows = [
      ...(workspace ? [workspace as Record<string, unknown>] : []),
      ...(workspaceMembers ?? []),
      ...(boards ?? []),
      ...(boardMembers ?? []),
      ...(lists ?? []),
      ...(cards ?? []),
      ...(labels ?? []),
      ...(cardAssignees ?? []),
      ...(cardWatchers ?? []),
      ...(comments ?? []),
      ...(attachments ?? []),
      ...(activities ?? []),
      ...(customFields ?? []),
      ...(boardPowerUps ?? []),
    ];

    collectIds(allRows, [
      "created_by",
      "user_id",
      "actor_id",
      "uploader_id",
      "assigned_by",
      "invited_by",
    ]).forEach((id) => {
      referencedUserIds.add(id);
    });

    const { data: profiles, error: profilesError } = referencedUserIds.size
      ? await supabase
          .from("profiles")
          .select("id, email, display_name, avatar_url, avatar_color")
          .in("id", Array.from(referencedUserIds))
      : { data: [] as TableRows, error: null };
    if (profilesError) {
      throw new ApiError(500, "profile_lookup_failed", profilesError.message);
    }

    const exportedAt = new Date().toISOString();
    const exportPayload = {
      exportedAt,
      workspace,
      workspace_members: workspaceMembers ?? [],
      boards: boards ?? [],
      board_members: boardMembers ?? [],
      lists: lists ?? [],
      cards: cards ?? [],
      labels: labels ?? [],
      card_labels: cardLabels ?? [],
      card_assignees: cardAssignees ?? [],
      card_watchers: cardWatchers ?? [],
      checklists: checklists ?? [],
      checklist_items: checklistItems ?? [],
      comments: comments ?? [],
      attachments: attachments ?? [],
      activities: activities ?? [],
      custom_fields: customFields ?? [],
      card_custom_field_values: cardCustomFieldValues ?? [],
      board_power_ups: boardPowerUps ?? [],
      profiles: profiles ?? [],
    };

    const safeSlug = toStringId(workspace.slug) ?? workspaceId;
    const timestamp = exportedAt.replace(/[:.]/g, "-");
    const filename = `workspace-${safeSlug}-${timestamp}.json`;

    return new Response(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return fail(error as Error);
  }
}
