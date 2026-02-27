-- myTaskApp Premium parity completion:
-- custom fields, power-ups, import jobs, and public board read policies.

create extension if not exists pgcrypto;

create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  field_type text not null default 'text',
  options jsonb not null default '[]',
  position double precision not null default 1000,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (field_type in ('text', 'number', 'date', 'checkbox', 'select'))
);

create table if not exists public.card_custom_field_values (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  custom_field_id uuid not null references public.custom_fields(id) on delete cascade,
  value_text text,
  value_number numeric(14, 4),
  value_date timestamptz,
  value_boolean boolean,
  value_option text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, custom_field_id)
);

create table if not exists public.board_power_ups (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  power_up_key text not null,
  display_name text not null,
  is_enabled boolean not null default true,
  config jsonb not null default '{}',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, power_up_key)
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type text not null default 'myTaskApp',
  status text not null default 'started',
  summary jsonb not null default '{}',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_type in ('myTaskApp')),
  check (status in ('started', 'success', 'failed'))
);

create index if not exists idx_custom_fields_board_position
  on public.custom_fields(board_id, position);

create index if not exists idx_card_custom_field_values_card
  on public.card_custom_field_values(card_id);

create index if not exists idx_board_power_ups_board
  on public.board_power_ups(board_id);

create index if not exists idx_import_jobs_workspace_created
  on public.import_jobs(workspace_id, created_at desc);

drop trigger if exists custom_fields_set_updated_at on public.custom_fields;
create trigger custom_fields_set_updated_at
  before update on public.custom_fields
  for each row execute function public.handle_updated_at();

drop trigger if exists card_custom_field_values_set_updated_at on public.card_custom_field_values;
create trigger card_custom_field_values_set_updated_at
  before update on public.card_custom_field_values
  for each row execute function public.handle_updated_at();

drop trigger if exists board_power_ups_set_updated_at on public.board_power_ups;
create trigger board_power_ups_set_updated_at
  before update on public.board_power_ups
  for each row execute function public.handle_updated_at();

drop trigger if exists import_jobs_set_updated_at on public.import_jobs;
create trigger import_jobs_set_updated_at
  before update on public.import_jobs
  for each row execute function public.handle_updated_at();

alter table public.custom_fields enable row level security;
alter table public.card_custom_field_values enable row level security;
alter table public.board_power_ups enable row level security;
alter table public.import_jobs enable row level security;

drop policy if exists "custom_fields_all_board_member" on public.custom_fields;
create policy "custom_fields_all_board_member"
on public.custom_fields
for all
to authenticated
using (public.has_board_access(board_id))
with check (public.has_board_access(board_id));

drop policy if exists "card_custom_field_values_all_board_member" on public.card_custom_field_values;
create policy "card_custom_field_values_all_board_member"
on public.card_custom_field_values
for all
to authenticated
using (
  exists (
    select 1
    from public.cards c
    join public.custom_fields f on f.id = custom_field_id
    where c.id = card_id
      and c.board_id = f.board_id
      and public.has_board_access(c.board_id)
  )
)
with check (
  exists (
    select 1
    from public.cards c
    join public.custom_fields f on f.id = custom_field_id
    where c.id = card_id
      and c.board_id = f.board_id
      and public.has_board_access(c.board_id)
  )
);

drop policy if exists "board_power_ups_select_board_member" on public.board_power_ups;
create policy "board_power_ups_select_board_member"
on public.board_power_ups
for select
to authenticated
using (public.has_board_access(board_id));

drop policy if exists "board_power_ups_write_board_admin" on public.board_power_ups;
create policy "board_power_ups_write_board_admin"
on public.board_power_ups
for all
to authenticated
using (public.has_board_admin_access(board_id))
with check (public.has_board_admin_access(board_id));

drop policy if exists "import_jobs_all_workspace_member" on public.import_jobs;
create policy "import_jobs_all_workspace_member"
on public.import_jobs
for all
to authenticated
using (public.has_workspace_access(workspace_id))
with check (public.has_workspace_access(workspace_id));

-- Public board read access (read-only).
drop policy if exists "boards_select_public_visibility" on public.boards;
create policy "boards_select_public_visibility"
on public.boards
for select
to anon, authenticated
using (visibility = 'public');

drop policy if exists "lists_select_public_board" on public.lists;
create policy "lists_select_public_board"
on public.lists
for select
to anon, authenticated
using (
  is_archived = false
  and exists (
    select 1
    from public.boards b
    where b.id = board_id
      and b.visibility = 'public'
  )
);

drop policy if exists "cards_select_public_board" on public.cards;
create policy "cards_select_public_board"
on public.cards
for select
to anon, authenticated
using (
  archived = false
  and exists (
    select 1
    from public.boards b
    where b.id = board_id
      and b.visibility = 'public'
  )
);

drop policy if exists "labels_select_public_board" on public.labels;
create policy "labels_select_public_board"
on public.labels
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.boards b
    where b.id = board_id
      and b.visibility = 'public'
  )
);

drop policy if exists "card_labels_select_public_board" on public.card_labels;
create policy "card_labels_select_public_board"
on public.card_labels
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.cards c
    join public.boards b on b.id = c.board_id
    where c.id = card_id
      and b.visibility = 'public'
  )
);

drop policy if exists "checklists_select_public_board" on public.checklists;
create policy "checklists_select_public_board"
on public.checklists
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.cards c
    join public.boards b on b.id = c.board_id
    where c.id = card_id
      and b.visibility = 'public'
  )
);

drop policy if exists "checklist_items_select_public_board" on public.checklist_items;
create policy "checklist_items_select_public_board"
on public.checklist_items
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.checklists ch
    join public.cards c on c.id = ch.card_id
    join public.boards b on b.id = c.board_id
    where ch.id = checklist_id
      and b.visibility = 'public'
  )
);

drop policy if exists "comments_select_public_board" on public.comments;
create policy "comments_select_public_board"
on public.comments
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.cards c
    join public.boards b on b.id = c.board_id
    where c.id = card_id
      and b.visibility = 'public'
  )
);

drop policy if exists "attachments_select_public_board" on public.attachments;
create policy "attachments_select_public_board"
on public.attachments
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.cards c
    join public.boards b on b.id = c.board_id
    where c.id = card_id
      and b.visibility = 'public'
  )
);

drop policy if exists "activities_select_public_board" on public.activities;
create policy "activities_select_public_board"
on public.activities
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.boards b
    where b.id = board_id
      and b.visibility = 'public'
  )
);

drop policy if exists "card_activity_select_public_board" on public.card_activity;
create policy "card_activity_select_public_board"
on public.card_activity
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.boards b
    where b.id = board_id
      and b.visibility = 'public'
  )
);

drop policy if exists "custom_fields_select_public_board" on public.custom_fields;
create policy "custom_fields_select_public_board"
on public.custom_fields
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.boards b
    where b.id = board_id
      and b.visibility = 'public'
  )
);

drop policy if exists "card_custom_field_values_select_public_board" on public.card_custom_field_values;
create policy "card_custom_field_values_select_public_board"
on public.card_custom_field_values
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.cards c
    join public.boards b on b.id = c.board_id
    where c.id = card_id
      and b.visibility = 'public'
  )
);

drop policy if exists "board_power_ups_select_public_board" on public.board_power_ups;
create policy "board_power_ups_select_public_board"
on public.board_power_ups
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.boards b
    where b.id = board_id
      and b.visibility = 'public'
  )
);
