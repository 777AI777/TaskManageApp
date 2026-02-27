alter table public.checklist_items
  add column if not exists assignee_id uuid references public.profiles(id) on delete set null;

alter table public.checklist_items
  add column if not exists due_at timestamptz;

create index if not exists idx_checklist_items_assignee_id on public.checklist_items(assignee_id);
create index if not exists idx_checklist_items_due_at on public.checklist_items(due_at);
