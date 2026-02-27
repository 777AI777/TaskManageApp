import { z } from "zod";

export const inviteSchema = z.object({
  workspaceId: z.uuid(),
  email: z.email(),
  role: z.enum(["workspace_admin", "board_admin", "member"]).default("member"),
});

export const workspaceCreateSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).nullable().optional(),
});

export const boardCreateSchema = z.object({
  workspaceId: z.uuid(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
  templateId: z.uuid().nullable().optional(),
  visibility: z.enum(["private", "workspace", "public"]).optional(),
});

export const boardPatchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
  slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/).optional(),
  visibility: z.enum(["private", "workspace", "public"]).optional(),
  dashboardTiles: z
    .array(
      z.object({
        id: z.uuid(),
        chartType: z.enum(["bar", "pie", "line"]),
        metric: z.enum(["cards_per_list", "due_status", "cards_per_member", "cards_per_label"]),
        title: z.string().min(1).max(120),
        position: z.number().int().nonnegative(),
        size: z.enum(["half", "full"]),
      }),
    )
    .max(24)
    .optional(),
  isArchived: z.boolean().optional(),
});

export const listCreateSchema = z.object({
  boardId: z.uuid(),
  name: z.string().min(1).max(80),
  position: z.number().optional(),
});

export const listPatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  position: z.number().optional(),
  isArchived: z.boolean().optional(),
});

export const cardCreateSchema = z.object({
  boardId: z.uuid(),
  listId: z.uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  position: z.number().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  estimatePoints: z.number().nonnegative().nullable().optional(),
  startAt: z.iso.datetime().nullable().optional(),
  locationName: z.string().max(255).nullable().optional(),
  locationLat: z.number().min(-90).max(90).nullable().optional(),
  locationLng: z.number().min(-180).max(180).nullable().optional(),
  assigneeIds: z.array(z.uuid()).optional(),
  labelIds: z.array(z.uuid()).optional(),
});

export const cardPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  listId: z.uuid().optional(),
  position: z.number().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  estimatePoints: z.number().nonnegative().nullable().optional(),
  startAt: z.iso.datetime().nullable().optional(),
  archived: z.boolean().optional(),
  coverColor: z.string().max(32).nullable().optional(),
  coverType: z.enum(["none", "color", "image"]).optional(),
  coverValue: z.string().max(1000).nullable().optional(),
  locationName: z.string().max(255).nullable().optional(),
  locationLat: z.number().min(-90).max(90).nullable().optional(),
  locationLng: z.number().min(-180).max(180).nullable().optional(),
  isCompleted: z.boolean().optional(),
  assigneeIds: z.array(z.uuid()).optional(),
  labelIds: z.array(z.uuid()).optional(),
});

export const cardMoveSchema = z.object({
  listId: z.uuid(),
  position: z.number(),
});

export const commentCreateSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const checklistCreateSchema = z.object({
  title: z.string().min(1).max(120),
});

export const checklistItemCreateSchema = z.object({
  checklistId: z.uuid(),
  content: z.string().min(1).max(500),
  position: z.number().optional(),
  assigneeId: z.uuid().nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
});

export const checklistItemPatchSchema = z.object({
  content: z.string().min(1).max(500).optional(),
  isCompleted: z.boolean().optional(),
  position: z.number().optional(),
  assigneeId: z.uuid().nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
});

export const attachmentCreateSchema = z.object({
  name: z.string().min(1).max(255),
  storagePath: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().nonnegative(),
  previewUrl: z.url().nullable().optional(),
});

export const automationRuleCreateSchema = z.object({
  workspaceId: z.uuid(),
  boardId: z.uuid().nullable().optional(),
  name: z.string().min(2).max(120),
  trigger: z.enum([
    "card_moved",
    "due_soon",
    "overdue",
    "label_added",
    "checklist_completed",
  ]),
  isActive: z.boolean().default(true),
  conditions: z
    .array(
      z.object({
        type: z.string().min(1).max(80),
        payload: z.record(z.string(), z.unknown()).default({}),
        position: z.number().int().nonnegative().default(0),
      }),
    )
    .default([]),
  actions: z
    .array(
      z.object({
        action: z.enum([
          "move_card",
          "add_label",
          "assign_member",
          "set_due_date",
          "post_comment",
          "notify",
        ]),
        payload: z.record(z.string(), z.unknown()).default({}),
        position: z.number().int().nonnegative().default(0),
      }),
    )
    .min(1),
});

export const automationRulePatchSchema = automationRuleCreateSchema.partial().omit({
  workspaceId: true,
});

export const inboxItemCreateSchema = z.object({
  workspaceId: z.uuid(),
  boardId: z.uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  sourceType: z.string().min(1).max(64).default("manual"),
  sourceMeta: z.record(z.string(), z.unknown()).optional(),
  position: z.number().optional(),
});

export const inboxItemPatchSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  isArchived: z.boolean().optional(),
  position: z.number().optional(),
});

export const onboardingSessionPatchSchema = z.object({
  boardId: z.uuid(),
  flow: z.enum(["main", "starter"]).default("main"),
  currentStep: z.number().int().nonnegative().optional(),
  isCompleted: z.boolean().optional(),
});

export const userBoardPreferencesPatchSchema = z.object({
  boardId: z.uuid(),
  selectedView: z.enum(["board", "calendar", "table", "timeline", "dashboard"]).optional(),
  leftRailCollapsed: z.boolean().optional(),
  showGuides: z.boolean().optional(),
});

export const customFieldOptionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
});

export const customFieldCreateSchema = z.object({
  name: z.string().min(1).max(120),
  fieldType: z.enum(["text", "number", "date", "checkbox", "select"]),
  options: z.array(customFieldOptionSchema).default([]),
  position: z.number().optional(),
});

export const customFieldPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  fieldType: z.enum(["text", "number", "date", "checkbox", "select"]).optional(),
  options: z.array(customFieldOptionSchema).optional(),
  position: z.number().optional(),
});

export const cardCustomFieldValuesPatchSchema = z.object({
  values: z.array(
    z.object({
      customFieldId: z.uuid(),
      valueText: z.string().max(5000).nullable().optional(),
      valueNumber: z.number().nullable().optional(),
      valueDate: z.iso.datetime().nullable().optional(),
      valueBoolean: z.boolean().nullable().optional(),
      valueOption: z.string().max(120).nullable().optional(),
    }),
  ),
});

export const boardPowerUpPatchSchema = z.object({
  powerUpKey: z.string().min(1).max(80),
  displayName: z.string().min(1).max(120).optional(),
  isEnabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
});

