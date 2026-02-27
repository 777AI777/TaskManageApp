-- Unify board backgrounds to a single neutral color.
alter table public.boards
  alter column background_type set default 'solid';

alter table public.boards
  alter column background_value set default '#c0c5d1';

update public.boards
set
  background_type = 'solid',
  background_value = '#c0c5d1'
where background_type is distinct from 'solid'
   or background_value is distinct from '#c0c5d1';
