export type Role = "workspace_admin" | "board_admin" | "member";

export type CardPriority = "low" | "medium" | "high" | "urgent";

export type AutomationTrigger =
  | "card_moved"
  | "due_soon"
  | "overdue"
  | "label_added"
  | "checklist_completed";

export type AutomationAction =
  | "move_card"
  | "add_label"
  | "assign_member"
  | "set_due_date"
  | "post_comment"
  | "notify";

export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface List {
  id: string;
  board_id: string;
  name: string;
  position: number;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
  due_at: string | null;
  priority: CardPriority;
  estimate_points: number | null;
  start_at: string | null;
  archived: boolean;
  cover_color: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ApiEnvelope<T> {
  data: T;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
