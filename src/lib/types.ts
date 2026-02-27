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
  slug: string;
  description: string | null;
  color: string | null;
  visibility: "private" | "workspace" | "public";
  dashboard_tiles: DashboardTile[];
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardTile {
  id: string;
  chartType: "bar" | "pie" | "line";
  metric: "cards_per_list" | "due_status" | "cards_per_member" | "cards_per_label";
  title: string;
  position: number;
  size: "half" | "full";
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
}

export interface CardWatcher {
  id: string;
  card_id: string;
  user_id: string;
  created_at: string;
}

export type CustomFieldType = "text" | "number" | "date" | "checkbox" | "select";

export interface CustomField {
  id: string;
  board_id: string;
  name: string;
  field_type: CustomFieldType;
  options: Array<{ id: string; label: string }> | string[];
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CardCustomFieldValue {
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
}

export interface BoardPowerUp {
  id: string;
  board_id: string;
  power_up_key: string;
  display_name: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ImportJob {
  id: string;
  workspace_id: string;
  source_type: "myTaskApp";
  status: "started" | "success" | "failed";
  summary: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InboxItem {
  id: string;
  workspace_id: string;
  board_id: string | null;
  title: string;
  description: string | null;
  source_type: string;
  source_meta: Record<string, unknown>;
  is_archived: boolean;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface UserBoardPreferences {
  id: string;
  user_id: string;
  board_id: string;
  selected_view: "board" | "calendar" | "table" | "timeline" | "dashboard";
  left_rail_collapsed: boolean;
  show_guides: boolean;
  updated_at: string;
  created_at: string;
}

export interface OnboardingSession {
  id: string;
  user_id: string;
  board_id: string;
  flow: "main" | "starter";
  current_step: number;
  is_completed: boolean;
  last_seen_at: string | null;
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
