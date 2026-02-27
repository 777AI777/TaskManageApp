-- Expand allowed board view modes to include table view.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'user_board_preferences_selected_view_check'
  ) then
    alter table public.user_board_preferences
      drop constraint user_board_preferences_selected_view_check;
  end if;

  alter table public.user_board_preferences
    add constraint user_board_preferences_selected_view_check
    check (selected_view in ('board', 'calendar', 'table', 'timeline', 'dashboard', 'map'));
end $$;

update public.user_board_preferences
set selected_view = 'board'
where selected_view not in ('board', 'calendar', 'table', 'timeline', 'dashboard', 'map')
   or selected_view is null;
