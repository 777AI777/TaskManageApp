begin;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'cards'
    ) then
      alter publication supabase_realtime add table public.cards;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'comments'
    ) then
      alter publication supabase_realtime add table public.comments;
    end if;

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
