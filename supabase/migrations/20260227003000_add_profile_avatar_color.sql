-- Add profile avatar color with random defaults for new and existing users.
create or replace function public.random_avatar_color()
returns text
language sql
volatile
as $$
  with palette as (
    select array[
      '#0C66E4',
      '#1D7AFC',
      '#14B8A6',
      '#0EA5E9',
      '#16A34A',
      '#F97316',
      '#E11D48',
      '#DB2777',
      '#7C3AED',
      '#4F46E5'
    ] as colors
  )
  select colors[1 + floor(random() * array_length(colors, 1))::int]
  from palette;
$$;

alter table public.profiles
  add column if not exists avatar_color text;

alter table public.profiles
  alter column avatar_color set default public.random_avatar_color();

update public.profiles
set avatar_color = public.random_avatar_color()
where avatar_color is null
   or avatar_color !~ '^#[0-9A-Fa-f]{6}$';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_avatar_color_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_color_format_check
      check (avatar_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end
$$;

alter table public.profiles
  alter column avatar_color set not null;
