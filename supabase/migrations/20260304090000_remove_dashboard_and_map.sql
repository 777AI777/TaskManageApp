update public.user_board_preferences
set selected_view = 'board'
where selected_view in ('dashboard', 'map')
   or selected_view is null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'user_board_preferences_selected_view_check'
  ) then
    alter table public.user_board_preferences
      drop constraint user_board_preferences_selected_view_check;
  end if;

  alter table public.user_board_preferences
    add constraint user_board_preferences_selected_view_check
    check (selected_view in ('board', 'calendar', 'table', 'timeline'));
end
$$;

delete from public.board_power_ups
where power_up_key = 'map';

alter table public.boards
  drop column if exists dashboard_tiles;

alter table public.cards
  drop column if exists location_name,
  drop column if exists location_lat,
  drop column if exists location_lng;
