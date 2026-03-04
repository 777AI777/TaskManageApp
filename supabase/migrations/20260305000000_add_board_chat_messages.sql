begin;

create table if not exists public.board_chat_messages (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_board_chat_messages_board_created_at
  on public.board_chat_messages(board_id, created_at desc);

drop trigger if exists board_chat_messages_set_updated_at on public.board_chat_messages;
create trigger board_chat_messages_set_updated_at
  before update on public.board_chat_messages
  for each row execute function public.handle_updated_at();

alter table public.board_chat_messages enable row level security;

drop policy if exists "board_chat_messages_all_board_member" on public.board_chat_messages;
create policy "board_chat_messages_all_board_member"
on public.board_chat_messages
for all
to authenticated
using (public.has_board_access(board_id))
with check (public.has_board_access(board_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'board_chat_messages'
    ) then
      alter publication supabase_realtime add table public.board_chat_messages;
    end if;
  end if;
end
$$;

commit;
