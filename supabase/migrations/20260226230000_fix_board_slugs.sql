-- Backfill null/empty slugs for all boards (idempotent)
update public.boards
set slug = concat(
  trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))),
  '-',
  substr(id::text, 1, 6)
)
where slug is null or slug = '';

update public.boards
set slug = concat('board-', substr(id::text, 1, 8))
where slug is null or slug = '';
