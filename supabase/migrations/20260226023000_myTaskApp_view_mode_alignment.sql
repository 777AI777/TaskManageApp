-- Align board view preferences with myTaskApp-style views.
update public.user_board_preferences
set selected_view = 'board'
where selected_view in ('inbox', 'planner')
  or selected_view is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_board_preferences_selected_view_check'
  ) then
    alter table public.user_board_preferences
      add constraint user_board_preferences_selected_view_check
      check (selected_view in ('board', 'calendar', 'table', 'timeline', 'dashboard', 'map'));
  end if;
end $$;
