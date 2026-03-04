begin;

alter table public.boards
  add column if not exists board_code text;

alter table public.boards
  add column if not exists next_task_number bigint not null default 1;

alter table public.cards
  add column if not exists task_number bigint;

update public.boards
set board_code = upper(substr(replace(id::text, '-', ''), 1, 8))
where board_code is null
   or btrim(board_code) = '';

with ranked as (
  select
    id,
    row_number() over (
      partition by board_id
      order by created_at asc, id asc
    )::bigint as task_number
  from public.cards
)
update public.cards as cards
set task_number = ranked.task_number
from ranked
where cards.id = ranked.id
  and cards.task_number is null;

update public.boards as boards
set next_task_number = coalesce((
  select max(cards.task_number) + 1
  from public.cards as cards
  where cards.board_id = boards.id
), 1);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'boards_board_code_format_check'
  ) then
    alter table public.boards
      add constraint boards_board_code_format_check
      check (board_code ~ '^[A-Z0-9_-]{2,10}$');
  end if;
end
$$;

create unique index if not exists boards_workspace_board_code_unique
  on public.boards(workspace_id, board_code);

create unique index if not exists cards_board_task_number_unique
  on public.cards(board_id, task_number);

alter table public.boards
  alter column board_code set not null;

alter table public.cards
  alter column task_number set not null;

create or replace function public.assign_card_task_number()
returns trigger
language plpgsql
as $$
declare
  allocated_task_number bigint;
begin
  if new.task_number is not null then
    return new;
  end if;

  update public.boards
  set next_task_number = coalesce(next_task_number, 1) + 1
  where id = new.board_id
  returning next_task_number - 1 into allocated_task_number;

  if allocated_task_number is null then
    raise exception 'board_not_found_for_task_number: %', new.board_id;
  end if;

  new.task_number = allocated_task_number;
  return new;
end;
$$;

drop trigger if exists cards_assign_task_number on public.cards;
create trigger cards_assign_task_number
before insert on public.cards
for each row execute function public.assign_card_task_number();

create or replace function public.ensure_board_code_default()
returns trigger
language plpgsql
as $$
begin
  if new.board_code is null or btrim(new.board_code) = '' then
    new.board_code := upper(substr(replace(new.id::text, '-', ''), 1, 8));
    return new;
  end if;

  new.board_code := upper(regexp_replace(new.board_code, '[^A-Za-z0-9_-]', '', 'g'));
  new.board_code := substr(new.board_code, 1, 10);

  if length(new.board_code) < 2 then
    new.board_code := upper(substr(replace(new.id::text, '-', ''), 1, 8));
  end if;

  return new;
end;
$$;

drop trigger if exists boards_ensure_board_code on public.boards;
create trigger boards_ensure_board_code
before insert on public.boards
for each row execute function public.ensure_board_code_default();

commit;
