begin;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'activities'
    ) then
      alter publication supabase_realtime drop table public.activities;
    end if;

    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'card_activity'
    ) then
      alter publication supabase_realtime drop table public.card_activity;
    end if;

    if exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'automation_runs'
    ) then
      alter publication supabase_realtime drop table public.automation_runs;
    end if;
  end if;
end
$$;

drop table if exists public.card_activity cascade;
drop table if exists public.activities cascade;
drop table if exists public.automation_runs cascade;

commit;
