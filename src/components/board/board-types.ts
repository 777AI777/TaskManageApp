import type { CardPriority } from "@/lib/types";

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
  cover_color: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
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

export type BoardDataBundle = {
  workspace: {
    id: string;
    name: string;
  };
  board: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  };
  lists: BoardList[];
  cards: BoardCard[];
  labels: Label[];
  members: BoardMember[];
  cardAssignees: CardAssignee[];
  cardLabels: CardLabel[];
  comments: CardComment[];
  checklists: Checklist[];
  checklistItems: ChecklistItem[];
  attachments: Attachment[];
  activities: Activity[];
};
