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
});

export const boardPatchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
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
});

export const checklistItemPatchSchema = z.object({
  content: z.string().min(1).max(500).optional(),
  isCompleted: z.boolean().optional(),
  position: z.number().optional(),
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
