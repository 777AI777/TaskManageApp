insert into public.profiles (id, email, display_name)
select
  u.id,
  u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
    split_part(u.email, '@', 1)
  ) as display_name
from auth.users u
where u.email is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = u.id
  )
on conflict (id) do nothing;
