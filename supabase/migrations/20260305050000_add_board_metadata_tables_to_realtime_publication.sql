begin;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'card_assignees'
    ) then
      alter publication supabase_realtime add table public.card_assignees;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'card_labels'
    ) then
      alter publication supabase_realtime add table public.card_labels;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'card_custom_field_values'
    ) then
      alter publication supabase_realtime add table public.card_custom_field_values;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'labels'
    ) then
      alter publication supabase_realtime add table public.labels;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'custom_fields'
    ) then
      alter publication supabase_realtime add table public.custom_fields;
    end if;
  end if;
end
$$;

commit;
