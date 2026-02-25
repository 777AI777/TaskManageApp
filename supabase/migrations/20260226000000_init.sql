create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_type') then
    create type public.role_type as enum ('workspace_admin', 'board_admin', 'member');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'card_priority_type') then
    create type public.card_priority_type as enum ('low', 'medium', 'high', 'urgent');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invite_status_type') then
    create type public.invite_status_type as enum ('pending', 'accepted', 'expired', 'revoked');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'automation_trigger_type') then
    create type public.automation_trigger_type as enum (
      'card_moved',
      'due_soon',
      'overdue',
      'label_added',
      'checklist_completed'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'automation_action_type') then
    create type public.automation_action_type as enum (
      'move_card',
      'add_label',
      'assign_member',
      'set_due_date',
      'post_comment',
      'notify'
    );
  end if;
end $$;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  timezone text not null default 'Asia/Tokyo',
  locale text not null default 'ja-JP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.role_type not null default 'member',
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  color text default '#2563eb',
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.role_type not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, user_id)
);

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  position double precision not null default 1000,
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  title text not null,
  description text,
  position double precision not null default 1000,
  due_at timestamptz,
  priority public.card_priority_type not null default 'medium',
  estimate_points numeric(7, 2),
  start_at timestamptz,
  archived boolean not null default false,
  cover_color text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_assignees (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (card_id, user_id)
);

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_labels (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  unique (card_id, label_id)
);

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  title text not null,
  position double precision not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  content text not null,
  is_completed boolean not null default false,
  position double precision not null default 1000,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete set null,
  name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  card_id uuid references public.cards(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_id uuid references public.boards(id) on delete cascade,
  card_id uuid references public.cards(id) on delete cascade,
  type text not null,
  message text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.role_type not null default 'member',
  token text not null unique,
  status public.invite_status_type not null default 'pending',
  inviter_id uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  kind text not null default 'board',
  payload jsonb not null default '{}',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_id uuid references public.boards(id) on delete cascade,
  name text not null,
  trigger public.automation_trigger_type not null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_rule_conditions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  condition_type text not null,
  condition_payload jsonb not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_rule_actions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  action public.automation_action_type not null,
  action_payload jsonb not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  trigger_source text not null,
  status text not null,
  details jsonb not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_cards_board_list_position on public.cards(board_id, list_id, position);
create index if not exists idx_cards_due_at on public.cards(due_at);
create index if not exists idx_activities_board_created_at on public.activities(board_id, created_at desc);
create index if not exists idx_notifications_user_read_created on public.notifications(user_id, read_at, created_at desc);
create index if not exists idx_invites_workspace_email_status on public.invites(workspace_id, email, status);
create index if not exists idx_lists_board_position on public.lists(board_id, position);
create index if not exists idx_checklist_items_checklist_position on public.checklist_items(checklist_id, position);
create index if not exists idx_comments_card_created_at on public.comments(card_id, created_at);
create index if not exists idx_automation_rules_workspace_trigger on public.automation_rules(workspace_id, trigger);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.handle_updated_at();
drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.handle_updated_at();
drop trigger if exists workspace_members_set_updated_at on public.workspace_members;
create trigger workspace_members_set_updated_at before update on public.workspace_members for each row execute function public.handle_updated_at();
drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at before update on public.boards for each row execute function public.handle_updated_at();
drop trigger if exists board_members_set_updated_at on public.board_members;
create trigger board_members_set_updated_at before update on public.board_members for each row execute function public.handle_updated_at();
drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at before update on public.lists for each row execute function public.handle_updated_at();
drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at before update on public.cards for each row execute function public.handle_updated_at();
drop trigger if exists labels_set_updated_at on public.labels;
create trigger labels_set_updated_at before update on public.labels for each row execute function public.handle_updated_at();
drop trigger if exists checklists_set_updated_at on public.checklists;
create trigger checklists_set_updated_at before update on public.checklists for each row execute function public.handle_updated_at();
drop trigger if exists checklist_items_set_updated_at on public.checklist_items;
create trigger checklist_items_set_updated_at before update on public.checklist_items for each row execute function public.handle_updated_at();
drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at before update on public.comments for each row execute function public.handle_updated_at();
drop trigger if exists attachments_set_updated_at on public.attachments;
create trigger attachments_set_updated_at before update on public.attachments for each row execute function public.handle_updated_at();
drop trigger if exists invites_set_updated_at on public.invites;
create trigger invites_set_updated_at before update on public.invites for each row execute function public.handle_updated_at();
drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at before update on public.templates for each row execute function public.handle_updated_at();
drop trigger if exists automation_rules_set_updated_at on public.automation_rules;
create trigger automation_rules_set_updated_at before update on public.automation_rules for each row execute function public.handle_updated_at();
drop trigger if exists automation_rule_conditions_set_updated_at on public.automation_rule_conditions;
create trigger automation_rule_conditions_set_updated_at before update on public.automation_rule_conditions for each row execute function public.handle_updated_at();
drop trigger if exists automation_rule_actions_set_updated_at on public.automation_rule_actions;
create trigger automation_rule_actions_set_updated_at before update on public.automation_rule_actions for each row execute function public.handle_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.has_workspace_access(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_admin_access(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'workspace_admin'
  );
$$;

create or replace function public.has_board_access(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.board_members bm
    where bm.board_id = target_board_id
      and bm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.boards b
    join public.workspace_members wm on wm.workspace_id = b.workspace_id
    where b.id = target_board_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.has_board_admin_access(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.board_members bm
    where bm.board_id = target_board_id
      and bm.user_id = auth.uid()
      and bm.role in ('board_admin', 'workspace_admin')
  )
  or exists (
    select 1
    from public.boards b
    join public.workspace_members wm on wm.workspace_id = b.workspace_id
    where b.id = target_board_id
      and wm.user_id = auth.uid()
      and wm.role = 'workspace_admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.lists enable row level security;
alter table public.cards enable row level security;
alter table public.card_assignees enable row level security;
alter table public.labels enable row level security;
alter table public.card_labels enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;
alter table public.invites enable row level security;
alter table public.templates enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_rule_conditions enable row level security;
alter table public.automation_rule_actions enable row level security;
alter table public.automation_runs enable row level security;

create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);

create policy "profiles_insert_self"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "workspaces_select_member"
on public.workspaces for select
to authenticated
using (public.has_workspace_access(id));

create policy "workspaces_insert_creator"
on public.workspaces for insert
to authenticated
with check (created_by = auth.uid());

create policy "workspaces_update_admin"
on public.workspaces for update
to authenticated
using (public.has_workspace_admin_access(id))
with check (public.has_workspace_admin_access(id));

create policy "workspaces_delete_admin"
on public.workspaces for delete
to authenticated
using (public.has_workspace_admin_access(id));

create policy "workspace_members_select_member"
on public.workspace_members for select
to authenticated
using (public.has_workspace_access(workspace_id));

create policy "workspace_members_insert_admin"
on public.workspace_members for insert
to authenticated
with check (public.has_workspace_admin_access(workspace_id));

create policy "workspace_members_update_admin"
on public.workspace_members for update
to authenticated
using (public.has_workspace_admin_access(workspace_id))
with check (public.has_workspace_admin_access(workspace_id));

create policy "workspace_members_delete_admin"
on public.workspace_members for delete
to authenticated
using (public.has_workspace_admin_access(workspace_id));

create policy "boards_select_workspace_member"
on public.boards for select
to authenticated
using (public.has_workspace_access(workspace_id));

create policy "boards_insert_workspace_member"
on public.boards for insert
to authenticated
with check (
  public.has_workspace_access(workspace_id)
  and created_by = auth.uid()
);

create policy "boards_update_board_admin"
on public.boards for update
to authenticated
using (public.has_board_admin_access(id))
with check (public.has_board_admin_access(id));

create policy "boards_delete_board_admin"
on public.boards for delete
to authenticated
using (public.has_board_admin_access(id));

create policy "board_members_select_board_member"
on public.board_members for select
to authenticated
using (public.has_board_access(board_id));

create policy "board_members_insert_board_admin"
on public.board_members for insert
to authenticated
with check (public.has_board_admin_access(board_id));

create policy "board_members_update_board_admin"
on public.board_members for update
to authenticated
using (public.has_board_admin_access(board_id))
with check (public.has_board_admin_access(board_id));

create policy "board_members_delete_board_admin"
on public.board_members for delete
to authenticated
using (public.has_board_admin_access(board_id));

create policy "lists_all_board_member"
on public.lists
for all
to authenticated
using (public.has_board_access(board_id))
with check (public.has_board_access(board_id));

create policy "cards_all_board_member"
on public.cards
for all
to authenticated
using (public.has_board_access(board_id))
with check (public.has_board_access(board_id));

create policy "card_assignees_all_board_member"
on public.card_assignees
for all
to authenticated
using (
  exists (
    select 1
    from public.cards c
    where c.id = card_id
      and public.has_board_access(c.board_id)
  )
)
with check (
  exists (
    select 1
    from public.cards c
    where c.id = card_id
      and public.has_board_access(c.board_id)
  )
);

create policy "labels_all_board_member"
on public.labels
for all
to authenticated
using (public.has_board_access(board_id))
with check (public.has_board_access(board_id));

create policy "card_labels_all_board_member"
on public.card_labels
for all
to authenticated
using (
  exists (
    select 1
    from public.cards c
    where c.id = card_id
      and public.has_board_access(c.board_id)
  )
)
with check (
  exists (
    select 1
    from public.cards c
    where c.id = card_id
      and public.has_board_access(c.board_id)
  )
);

create policy "checklists_all_board_member"
on public.checklists
for all
to authenticated
using (
  exists (
    select 1 from public.cards c
    where c.id = card_id
      and public.has_board_access(c.board_id)
  )
)
with check (
  exists (
    select 1 from public.cards c
    where c.id = card_id
      and public.has_board_access(c.board_id)
  )
);

create policy "checklist_items_all_board_member"
on public.checklist_items
for all
to authenticated
using (
  exists (
    select 1
    from public.checklists ch
    join public.cards c on c.id = ch.card_id
    where ch.id = checklist_id
      and public.has_board_access(c.board_id)
  )
)
with check (
  exists (
    select 1
    from public.checklists ch
    join public.cards c on c.id = ch.card_id
    where ch.id = checklist_id
      and public.has_board_access(c.board_id)
  )
);

create policy "comments_all_board_member"
on public.comments
for all
to authenticated
using (
  exists (
    select 1
    from public.cards c
    where c.id = card_id
      and public.has_board_access(c.board_id)
  )
)
with check (
  exists (
    select 1
    from public.cards c
    where c.id = card_id
      and public.has_board_access(c.board_id)
  )
);

create policy "attachments_all_board_member"
on public.attachments
for all
to authenticated
using (
  exists (
    select 1
    from public.cards c
    where c.id = card_id
      and public.has_board_access(c.board_id)
  )
)
with check (
  exists (
    select 1
    from public.cards c
    where c.id = card_id
      and public.has_board_access(c.board_id)
  )
);

create policy "activities_select_board_member"
on public.activities
for select
to authenticated
using (public.has_board_access(board_id));

create policy "activities_insert_board_member"
on public.activities
for insert
to authenticated
with check (public.has_board_access(board_id));

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create policy "notifications_insert_workspace_member"
on public.notifications
for insert
to authenticated
with check (public.has_workspace_access(workspace_id));

create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "invites_select_admin_or_email_owner"
on public.invites
for select
to authenticated
using (
  public.has_workspace_admin_access(workspace_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy "invites_write_workspace_admin"
on public.invites
for all
to authenticated
using (public.has_workspace_admin_access(workspace_id))
with check (public.has_workspace_admin_access(workspace_id));

create policy "templates_select_workspace_member"
on public.templates
for select
to authenticated
using (
  workspace_id is null
  or public.has_workspace_access(workspace_id)
  or is_public = true
);

create policy "templates_write_workspace_admin"
on public.templates
for all
to authenticated
using (
  workspace_id is not null
  and public.has_workspace_admin_access(workspace_id)
)
with check (
  workspace_id is not null
  and public.has_workspace_admin_access(workspace_id)
);

create policy "automation_rules_select_workspace_member"
on public.automation_rules
for select
to authenticated
using (public.has_workspace_access(workspace_id));

create policy "automation_rules_write_admin"
on public.automation_rules
for all
to authenticated
using (
  public.has_workspace_admin_access(workspace_id)
  or (board_id is not null and public.has_board_admin_access(board_id))
)
with check (
  public.has_workspace_admin_access(workspace_id)
  or (board_id is not null and public.has_board_admin_access(board_id))
);

create policy "automation_rule_conditions_access"
on public.automation_rule_conditions
for all
to authenticated
using (
  exists (
    select 1
    from public.automation_rules ar
    where ar.id = rule_id
      and public.has_workspace_access(ar.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.automation_rules ar
    where ar.id = rule_id
      and (
        public.has_workspace_admin_access(ar.workspace_id)
        or (ar.board_id is not null and public.has_board_admin_access(ar.board_id))
      )
  )
);

create policy "automation_rule_actions_access"
on public.automation_rule_actions
for all
to authenticated
using (
  exists (
    select 1
    from public.automation_rules ar
    where ar.id = rule_id
      and public.has_workspace_access(ar.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.automation_rules ar
    where ar.id = rule_id
      and (
        public.has_workspace_admin_access(ar.workspace_id)
        or (ar.board_id is not null and public.has_board_admin_access(ar.board_id))
      )
  )
);

create policy "automation_runs_access"
on public.automation_runs
for all
to authenticated
using (
  exists (
    select 1
    from public.automation_rules ar
    where ar.id = rule_id
      and public.has_workspace_access(ar.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.automation_rules ar
    where ar.id = rule_id
      and (
        public.has_workspace_admin_access(ar.workspace_id)
        or (ar.board_id is not null and public.has_board_admin_access(ar.board_id))
      )
  )
);

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments_storage_select_board_member"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attachments'
  and split_part(name, '/', 4) ~* '^[0-9a-f-]{36}$'
  and public.has_board_access(split_part(name, '/', 4)::uuid)
);

create policy "attachments_storage_insert_board_member"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and split_part(name, '/', 4) ~* '^[0-9a-f-]{36}$'
  and public.has_board_access(split_part(name, '/', 4)::uuid)
);

create policy "attachments_storage_update_board_member"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'attachments'
  and split_part(name, '/', 4) ~* '^[0-9a-f-]{36}$'
  and public.has_board_access(split_part(name, '/', 4)::uuid)
)
with check (
  bucket_id = 'attachments'
  and split_part(name, '/', 4) ~* '^[0-9a-f-]{36}$'
  and public.has_board_access(split_part(name, '/', 4)::uuid)
);

create policy "attachments_storage_delete_board_member"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attachments'
  and split_part(name, '/', 4) ~* '^[0-9a-f-]{36}$'
  and public.has_board_access(split_part(name, '/', 4)::uuid)
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table
        public.cards,
        public.lists,
        public.comments,
        public.activities,
        public.notifications;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;
