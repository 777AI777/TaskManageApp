-- Remove board background customization columns and related check constraint.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'boards_background_type_check'
  ) then
    alter table public.boards
      drop constraint boards_background_type_check;
  end if;
end
$$;

alter table public.boards
  drop column if exists background_type;

alter table public.boards
  drop column if exists background_value;
