import { requireApiUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ApiError, fail, ok } from "@/lib/http";
import { assertWorkspaceRole } from "@/lib/permissions";
import { ensurePosition, slugify, toIsoOrNull } from "@/lib/utils";

type myTaskAppBoardExport = {
  name?: unknown;
  desc?: unknown;
  labels?: unknown;
  lists?: unknown;
  cards?: unknown;
  checklists?: unknown;
};

type myTaskAppLabel = {
  id: string;
  name: string;
  color: string | null;
};

type myTaskAppList = {
  id: string;
  name: string;
  pos: number;
  closed: boolean;
};

type myTaskAppCard = {
  id: string;
  name: string;
  desc: string;
  idList: string;
  pos: number;
  due: string | null;
  dueComplete: boolean;
  idLabels: string[];
  closed: boolean;
  coverColor: string | null;
};

type myTaskAppChecklist = {
  id: string;
  idCard: string;
  name: string;
  pos: number;
  checkItems: Array<{
    name: string;
    pos: number;
    state: "complete" | "incomplete" | string;
  }>;
};

const myTaskApp_LABEL_COLORS: Record<string, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  purple: "#a855f7",
  blue: "#3b82f6",
  sky: "#0ea5e9",
  lime: "#84cc16",
  pink: "#ec4899",
  black: "#334155",
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeBoardExport(raw: unknown): myTaskAppBoardExport {
  if (Array.isArray(raw) && raw.length) {
    return normalizeBoardExport(raw[0]);
  }

  const object = asObject(raw);
  if (!object) {
    return {};
  }

  if (Array.isArray(object.boards) && object.boards.length) {
    return normalizeBoardExport(object.boards[0]);
  }

  return object;
}

function normalizeLabels(raw: unknown): myTaskAppLabel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => {
      const item = asObject(value);
      if (!item) return null;
      const id = asString(item.id).trim();
      if (!id) return null;
      const name = asString(item.name).trim();
      const color = asString(item.color).trim() || null;
      return { id, name, color };
    })
    .filter((value): value is myTaskAppLabel => value !== null);
}

function normalizeLists(raw: unknown): myTaskAppList[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => {
      const item = asObject(value);
      if (!item) return null;
      const id = asString(item.id).trim();
      if (!id) return null;
      return {
        id,
        name: asString(item.name, "Untitled list").trim() || "Untitled list",
        pos: asNumber(item.pos, Date.now()),
        closed: Boolean(item.closed),
      };
    })
    .filter((value): value is myTaskAppList => value !== null);
}

function normalizeCards(raw: unknown): myTaskAppCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => {
      const item = asObject(value);
      if (!item) return null;
      const id = asString(item.id).trim();
      if (!id) return null;

      const cover = asObject(item.cover);
      const idLabels = Array.isArray(item.idLabels)
        ? item.idLabels.map((labelId) => asString(labelId)).filter(Boolean)
        : [];

      return {
        id,
        name: asString(item.name, "Untitled card").trim() || "Untitled card",
        desc: asString(item.desc),
        idList: asString(item.idList),
        pos: asNumber(item.pos, Date.now()),
        due: toIsoOrNull(item.due),
        dueComplete: Boolean(item.dueComplete),
        idLabels,
        closed: Boolean(item.closed),
        coverColor: cover ? asString(cover.color).trim() || null : null,
      };
    })
    .filter((value): value is myTaskAppCard => value !== null);
}

function normalizeChecklists(raw: unknown): myTaskAppChecklist[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => {
      const item = asObject(value);
      if (!item) return null;
      const id = asString(item.id).trim();
      if (!id) return null;
      const checkItemsRaw = Array.isArray(item.checkItems) ? item.checkItems : [];
      const checkItems = checkItemsRaw
        .map((rawItem) => {
          const checkItem = asObject(rawItem);
          if (!checkItem) return null;
          return {
            name: asString(checkItem.name, "Untitled item").trim() || "Untitled item",
            pos: asNumber(checkItem.pos, Date.now()),
            state: asString(checkItem.state, "incomplete"),
          };
        })
        .filter((entry): entry is myTaskAppChecklist["checkItems"][number] => entry !== null);

      return {
        id,
        idCard: asString(item.idCard),
        name: asString(item.name, "Checklist").trim() || "Checklist",
        pos: asNumber(item.pos, Date.now()),
        checkItems,
      };
    })
    .filter((value): value is myTaskAppChecklist => value !== null);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let importJobId: string | null = null;
  let supabaseForFailure: Awaited<ReturnType<typeof requireApiUser>>["supabase"] | null = null;
  try {
    const { id: workspaceId } = await params;
    const { supabase, user } = await requireApiUser();
    supabaseForFailure = supabase;
    await assertWorkspaceRole(supabase, workspaceId, user.id, ["member"]);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "myTaskApp_file_missing", "myTaskAppエクスポートJSONファイルを指定してください。");
    }

    const boardNameOverride =
      typeof formData.get("boardName") === "string" && formData.get("boardName")
        ? String(formData.get("boardName")).trim()
        : null;

    const rawText = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new ApiError(400, "myTaskApp_json_invalid", "JSONの解析に失敗しました。");
    }

    const source = normalizeBoardExport(parsed);
    const labels = normalizeLabels(source.labels);
    const lists = normalizeLists(source.lists).filter((list) => !list.closed).sort((a, b) => a.pos - b.pos);
    const cards = normalizeCards(source.cards).filter((card) => !card.closed);
    const checklists = normalizeChecklists(source.checklists);

    if (!lists.length) {
      throw new ApiError(400, "myTaskApp_import_empty_lists", "有効なリストが見つかりません。");
    }

    const { data: importJob, error: importJobError } = await supabase
      .from("import_jobs")
      .insert({
        workspace_id: workspaceId,
        source_type: "myTaskApp",
        status: "started",
        created_by: user.id,
        summary: {
          fileName: file.name,
          fileSize: file.size,
        },
      })
      .select("id")
      .single();

    if (importJobError) {
      throw new ApiError(500, "import_job_create_failed", importJobError.message);
    }
    importJobId = importJob.id;

    const boardName = boardNameOverride || asString(source.name, "Imported myTaskApp Board").trim() || "Imported myTaskApp Board";
    const baseSlug = slugify(boardName) || "imported-board";
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .insert({
        workspace_id: workspaceId,
        name: boardName,
        slug: `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`,
        description: asString(source.desc).trim() || null,
        color: "#2563eb",
        visibility: "private",
        created_by: user.id,
      })
      .select("id, name, slug")
      .single();

    if (boardError) {
      throw new ApiError(500, "myTaskApp_import_board_create_failed", boardError.message);
    }

    const { data: workspaceMembers, error: workspaceMembersError } = await supabase
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspaceId);
    if (workspaceMembersError) {
      throw new ApiError(500, "workspace_member_lookup_failed", workspaceMembersError.message);
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

    const labelMap = new Map<string, string>();
    let importedLabels = 0;
    for (const label of labels) {
      if (!label.name && !label.color) {
        continue;
      }
      const mappedColor = label.color ? myTaskApp_LABEL_COLORS[label.color] ?? "#64748b" : "#64748b";
      const { data: createdLabel, error: createdLabelError } = await supabase
        .from("labels")
        .insert({
          board_id: board.id,
          name: label.name || label.color || "Label",
          color: mappedColor,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (createdLabelError) {
        throw new ApiError(500, "myTaskApp_import_label_create_failed", createdLabelError.message);
      }
      labelMap.set(label.id, createdLabel.id);
      importedLabels += 1;
    }

    const listMap = new Map<string, string>();
    let importedLists = 0;
    for (let index = 0; index < lists.length; index += 1) {
      const list = lists[index];
      const { data: createdList, error: createdListError } = await supabase
        .from("lists")
        .insert({
          board_id: board.id,
          name: list.name,
          position: ensurePosition(list.pos, (index + 1) * 1000),
          created_by: user.id,
        })
        .select("id")
        .single();
      if (createdListError) {
        throw new ApiError(500, "myTaskApp_import_list_create_failed", createdListError.message);
      }
      listMap.set(list.id, createdList.id);
      importedLists += 1;
    }

    let importedCards = 0;
    let importedChecklists = 0;
    let importedChecklistItems = 0;
    const cardMap = new Map<string, string>();
    const cardLabelRelations: Array<{ card_id: string; label_id: string }> = [];

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const mappedListId = listMap.get(card.idList);
      if (!mappedListId) {
        continue;
      }

      const { data: createdCard, error: createdCardError } = await supabase
        .from("cards")
        .insert({
          board_id: board.id,
          list_id: mappedListId,
          title: card.name,
          description: card.desc || null,
          position: ensurePosition(card.pos, (index + 1) * 1000),
          due_at: card.due,
          is_completed: card.dueComplete,
          completed_at: card.dueComplete ? new Date().toISOString() : null,
          cover_type: card.coverColor ? "color" : "none",
          cover_value: card.coverColor,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (createdCardError) {
        throw new ApiError(500, "myTaskApp_import_card_create_failed", createdCardError.message);
      }

      cardMap.set(card.id, createdCard.id);
      importedCards += 1;

      for (const sourceLabelId of card.idLabels) {
        const mappedLabelId = labelMap.get(sourceLabelId);
        if (mappedLabelId) {
          cardLabelRelations.push({
            card_id: createdCard.id,
            label_id: mappedLabelId,
          });
        }
      }
    }

    if (cardLabelRelations.length) {
      const { error: cardLabelError } = await supabase.from("card_labels").insert(cardLabelRelations);
      if (cardLabelError) {
        throw new ApiError(500, "myTaskApp_import_card_label_create_failed", cardLabelError.message);
      }
    }

    for (const checklist of checklists) {
      const mappedCardId = cardMap.get(checklist.idCard);
      if (!mappedCardId) {
        continue;
      }

      const { data: createdChecklist, error: createdChecklistError } = await supabase
        .from("checklists")
        .insert({
          card_id: mappedCardId,
          title: checklist.name,
          position: ensurePosition(checklist.pos, Date.now()),
        })
        .select("id")
        .single();
      if (createdChecklistError) {
        throw new ApiError(500, "myTaskApp_import_checklist_create_failed", createdChecklistError.message);
      }
      importedChecklists += 1;

      const items = checklist.checkItems
        .sort((a, b) => a.pos - b.pos)
        .map((item, index) => ({
          checklist_id: createdChecklist.id,
          content: item.name,
          is_completed: item.state === "complete",
          position: ensurePosition(item.pos, (index + 1) * 1000),
          completed_by: item.state === "complete" ? user.id : null,
          completed_at: item.state === "complete" ? new Date().toISOString() : null,
        }));

      if (items.length) {
        const { error: checklistItemsError } = await supabase.from("checklist_items").insert(items);
        if (checklistItemsError) {
          throw new ApiError(500, "myTaskApp_import_checklist_item_create_failed", checklistItemsError.message);
        }
        importedChecklistItems += items.length;
      }
    }

    const summary = {
      boardId: board.id,
      boardName: board.name,
      importedLists,
      importedCards,
      importedLabels,
      importedChecklists,
      importedChecklistItems,
    };

    const { error: importJobSuccessError } = await supabase
      .from("import_jobs")
      .update({
        status: "success",
        summary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", importJobId);
    if (importJobSuccessError) {
      throw new ApiError(500, "import_job_update_failed", importJobSuccessError.message);
    }

    await logActivity(supabase, {
      boardId: board.id,
      actorId: user.id,
      action: "myTaskApp_import_completed",
      metadata: summary,
    });

    return ok(
      {
        board,
        importJobId,
        summary,
      },
      { status: 201 },
    );
  } catch (error) {
    if (importJobId && supabaseForFailure) {
      try {
        await supabaseForFailure
          .from("import_jobs")
          .update({
            status: "failed",
            summary: {
              error: (error as Error).message,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", importJobId);
      } catch {
        // no-op
      }
    }
    return fail(error as Error);
  }
}
