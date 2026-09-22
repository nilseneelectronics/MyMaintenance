-- Neighborhood events are separate from the neighborhood JSON so private
-- events can be restricted to their creator.

create table if not exists public.neighborhood_events (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id) on delete cascade,
  creator_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  start_date date not null,
  finish_date date not null,
  start_time text not null default '',
  finish_time text not null default '',
  location text not null default '',
  description text not null default '',
  shared boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists neighborhood_events_visibility_idx
  on public.neighborhood_events (neighborhood_id, shared, start_date, start_time);

alter table public.neighborhood_events enable row level security;
grant select on public.neighborhood_events to authenticated;
grant execute on function public.is_current_neighborhood_member(uuid) to authenticated;

drop policy if exists "Members view visible neighborhood events" on public.neighborhood_events;
create policy "Members view visible neighborhood events"
on public.neighborhood_events for select to authenticated
using (
  creator_id = (select auth.uid())
  or (shared and public.is_current_neighborhood_member(neighborhood_id))
);

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('family_invitation', 'neighborhood_invitation', 'neighborhood_event', 'system'));

create or replace function public.create_neighborhood_event(
  p_neighborhood_id uuid,
  p_name text,
  p_start_date date,
  p_finish_date date,
  p_start_time text,
  p_finish_time text,
  p_location text,
  p_description text,
  p_shared boolean
)
returns public.neighborhood_events
language plpgsql
security definer
set search_path = public
as $$
declare
  created_event public.neighborhood_events;
  neighborhood_name text;
begin
  if not exists (
    select 1
    from public.neighborhoods n
    left join public.neighborhood_members m
      on m.neighborhood_id = n.id and m.user_id = (select auth.uid())
    where n.id = p_neighborhood_id
      and (n.owner_id = (select auth.uid()) or m.role in ('admin', 'edit'))
  ) then
    raise exception 'You do not have permission to add events to this neighborhood.';
  end if;

  select n.name into neighborhood_name
  from public.neighborhoods n
  where n.id = p_neighborhood_id;

  insert into public.neighborhood_events(
    neighborhood_id, creator_id, name, start_date, finish_date,
    start_time, finish_time, location, description, shared
  ) values (
    p_neighborhood_id, (select auth.uid()), trim(p_name), p_start_date,
    coalesce(p_finish_date, p_start_date), coalesce(p_start_time, ''),
    coalesce(p_finish_time, ''), coalesce(trim(p_location), ''),
    coalesce(trim(p_description), ''), coalesce(p_shared, false)
  ) returning * into created_event;

  if created_event.shared then
    insert into public.notifications(recipient_id, kind, reference_id, title, body)
    select recipients.recipient_id, 'neighborhood_event', created_event.id,
      'New neighborhood event',
      created_event.name || ' was added to ' || coalesce(neighborhood_name, 'your neighborhood') || '.'
    from (
      select n.owner_id as recipient_id
      from public.neighborhoods n
      where n.id = p_neighborhood_id
      union
      select m.user_id
      from public.neighborhood_members m
      where m.neighborhood_id = p_neighborhood_id
    ) recipients
    where recipients.recipient_id <> (select auth.uid())
    on conflict (recipient_id, kind, reference_id) do nothing;
  end if;

  return created_event;
end;
$$;

revoke all on function public.create_neighborhood_event(uuid, text, date, date, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_neighborhood_event(uuid, text, date, date, text, text, text, text, boolean) to authenticated;
