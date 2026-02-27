import type { CardPriority } from "@/lib/types";

import type { CardDeadlineState } from "@/lib/board-utils";

export type BoardList = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  is_archived: boolean;
};

export type BoardCard = {
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
  is_completed: boolean;
  completed_at: string | null;
  cover_color: string | null;
  cover_type: "none" | "color" | "image";
  cover_value: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type BoardCardMeta = {
  deadlineState: CardDeadlineState;
  dueLabel: string | null;
  assigneePrimary: string | null;
  assigneeInitial: string | null;
  assigneeColor: string | null;
  assigneeTooltip: string | null;
  assigneeExtraCount: number;
};

export type CardAssignee = {
  card_id: string;
  user_id: string;
};

export type CardLabel = {
  card_id: string;
  label_id: string;
};

export type Label = {
  id: string;
  board_id: string;
  name: string;
  color: string;
};

export type BoardMember = {
  user_id: string;
  role: string;
  profile: {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
    avatar_color: string | null;
  } | null;
};

export type CardComment = {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type Checklist = {
  id: string;
  card_id: string;
  title: string;
  position: number;
};

export type ChecklistItem = {
  id: string;
  checklist_id: string;
  content: string;
  is_completed: boolean;
  position: number;
  assignee_id: string | null;
  due_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
};

export type Attachment = {
  id: string;
  card_id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  preview_url: string | null;
  created_at: string;
};

export type Activity = {
  id: string;
  board_id: string;
  card_id: string | null;
  actor_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CardWatcher = {
  card_id: string;
  user_id: string;
};

export type CustomField = {
  id: string;
  board_id: string;
  name: string;
  field_type: "text" | "number" | "date" | "checkbox" | "select";
  options: Array<{ id: string; label: string }> | string[];
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CardCustomFieldValue = {
  id: string;
  card_id: string;
  custom_field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
  value_option: string | null;
  created_at: string;
  updated_at: string;
};

export type BoardPowerUp = {
  id: string;
  board_id: string;
  power_up_key: string;
  display_name: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DashboardTile = {
  id: string;
  chartType: "bar" | "pie" | "line";
  metric: "cards_per_list" | "due_status" | "cards_per_member" | "cards_per_label";
  title: string;
  position: number;
  size: "half" | "full";
};

export type UserBoardPreferences = {
  id: string;
  user_id: string;
  board_id: string;
  selected_view: "board" | "calendar" | "table" | "timeline" | "dashboard";
  left_rail_collapsed: boolean;
  show_guides: boolean;
  updated_at: string;
  created_at: string;
};

export type OnboardingSession = {
  id: string;
  user_id: string;
  board_id: string;
  flow: "main" | "starter";
  current_step: number;
  is_completed: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BoardDataBundle = {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  workspaceBoards: Array<{
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    slug: string;
    is_archived: boolean;
  }>;
  currentUser: {
    id: string;
    email: string | null;
    display_name: string | null;
    avatar_color: string | null;
    role: "workspace_admin" | "board_admin" | "member";
  };
  board: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    visibility: "private" | "workspace" | "public";
    dashboard_tiles: DashboardTile[];
  };
  lists: BoardList[];
  cards: BoardCard[];
  labels: Label[];
  members: BoardMember[];
  cardAssignees: CardAssignee[];
  cardLabels: CardLabel[];
  customFields: CustomField[];
  cardCustomFieldValues: CardCustomFieldValue[];
  preferences: UserBoardPreferences | null;
};

export type CardDetailData = {
  watchers: string[];
  comments: CardComment[];
  checklists: Checklist[];
  checklistItems: ChecklistItem[];
  attachments: Attachment[];
  activities: Activity[];
};

