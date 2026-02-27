-- myTaskApp parity core additions (cost-aware, no paid external integrations required)

create extension if not exists pgcrypto;

-- Boards: slug + visibility + background controls
alter table public.boards
  add column if not exists slug text;

alter table public.boards
  add column if not exists visibility text not null default 'private';

alter table public.boards
  add column if not exists background_type text not null default 'gradient';

alter table public.boards
  add column if not exists background_value text not null default 'linear-gradient(135deg,#0b5cad,#9139a8)';

update public.boards
set slug = concat(
  trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))),
  '-',
  substr(id::text, 1, 6)
)
where slug is null;

update public.boards
set slug = concat('board-', substr(id::text, 1, 8))
where slug = '' or slug is null;

create unique index if not exists idx_boards_slug_unique on public.boards(slug);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'boards_visibility_check'
  ) then
    alter table public.boards
      add constraint boards_visibility_check
      check (visibility in ('private', 'workspace', 'public'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'boards_background_type_check'
  ) then
    alter table public.boards
      add constraint boards_background_type_check
      check (background_type in ('gradient', 'image', 'solid'));
  end if;
end $$;

-- Cards: completion + cover metadata
alter table public.cards
  add column if not exists is_completed boolean not null default false;

alter table public.cards
  add column if not exists completed_at timestamptz;

alter table public.cards
  add column if not exists cover_type text not null default 'none';

alter table public.cards
  add column if not exists cover_value text;

-- Card watchers
create table if not exists public.card_watchers (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (card_id, user_id)
);

-- Inbox items (source integrations are represented as metadata only, no paid connection required)
create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_id uuid references public.boards(id) on delete set null,
  title text not null,
  description text,
  source_type text not null default 'manual',
  source_meta jsonb not null default '{}',
  is_archived boolean not null default false,
  position double precision not null default 1000,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-user board UI preferences
create table if not exists public.user_board_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  selected_view text not null default 'board',
  left_rail_collapsed boolean not null default false,
  show_guides boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, board_id)
);

-- Onboarding progress sessions
create table if not exists public.onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  flow text not null default 'main',
  current_step integer not null default 0,
  is_completed boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, board_id, flow)
);

-- Normalized card activity stream
create table if not exists public.card_activity (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  card_id uuid references public.cards(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_inbox_items_workspace_position
  on public.inbox_items(workspace_id, position);

create index if not exists idx_user_board_preferences_user_board
  on public.user_board_preferences(user_id, board_id);

create index if not exists idx_onboarding_sessions_user_board_flow
  on public.onboarding_sessions(user_id, board_id, flow);

create index if not exists idx_card_activity_board_created
  on public.card_activity(board_id, created_at desc);

create index if not exists idx_card_watchers_card_user
  on public.card_watchers(card_id, user_id);

drop trigger if exists inbox_items_set_updated_at on public.inbox_items;
create trigger inbox_items_set_updated_at
  before update on public.inbox_items
  for each row execute function public.handle_updated_at();

drop trigger if exists user_board_preferences_set_updated_at on public.user_board_preferences;
create trigger user_board_preferences_set_updated_at
  before update on public.user_board_preferences
  for each row execute function public.handle_updated_at();

drop trigger if exists onboarding_sessions_set_updated_at on public.onboarding_sessions;
create trigger onboarding_sessions_set_updated_at
  before update on public.onboarding_sessions
  for each row execute function public.handle_updated_at();

alter table public.card_watchers enable row level security;
alter table public.inbox_items enable row level security;
alter table public.user_board_preferences enable row level security;
alter table public.onboarding_sessions enable row level security;
alter table public.card_activity enable row level security;

drop policy if exists "card_watchers_all_board_member" on public.card_watchers;
create policy "card_watchers_all_board_member"
on public.card_watchers
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

drop policy if exists "inbox_items_all_workspace_member" on public.inbox_items;
create policy "inbox_items_all_workspace_member"
on public.inbox_items
for all
to authenticated
using (public.has_workspace_access(workspace_id))
with check (public.has_workspace_access(workspace_id));

drop policy if exists "user_board_preferences_owner" on public.user_board_preferences;
create policy "user_board_preferences_owner"
on public.user_board_preferences
for all
to authenticated
using (
  user_id = auth.uid()
  and public.has_board_access(board_id)
)
with check (
  user_id = auth.uid()
  and public.has_board_access(board_id)
);

drop policy if exists "onboarding_sessions_owner" on public.onboarding_sessions;
create policy "onboarding_sessions_owner"
on public.onboarding_sessions
for all
to authenticated
using (
  user_id = auth.uid()
  and public.has_board_access(board_id)
)
with check (
  user_id = auth.uid()
  and public.has_board_access(board_id)
);

drop policy if exists "card_activity_select_board_member" on public.card_activity;
create policy "card_activity_select_board_member"
on public.card_activity
for select
to authenticated
using (public.has_board_access(board_id));

drop policy if exists "card_activity_insert_board_member" on public.card_activity;
create policy "card_activity_insert_board_member"
on public.card_activity
for insert
to authenticated
with check (public.has_board_access(board_id));
