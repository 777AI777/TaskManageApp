-- Map view support: optional location metadata on cards.
alter table public.cards
  add column if not exists location_name text;

alter table public.cards
  add column if not exists location_lat double precision;

alter table public.cards
  add column if not exists location_lng double precision;
