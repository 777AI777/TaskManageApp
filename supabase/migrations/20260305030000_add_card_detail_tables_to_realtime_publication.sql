begin;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'checklists'
    ) then
      alter publication supabase_realtime add table public.checklists;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'checklist_items'
    ) then
      alter publication supabase_realtime add table public.checklist_items;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'attachments'
    ) then
      alter publication supabase_realtime add table public.attachments;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'card_watchers'
    ) then
      alter publication supabase_realtime add table public.card_watchers;
    end if;
  end if;
end
$$;

commit;
