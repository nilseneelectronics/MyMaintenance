-- Persist neighborhood access separately from the editable JSON details so
-- matching residents can load the neighborhood and its private files.

create table if not exists public.neighborhood_members (
  neighborhood_id uuid not null references public.neighborhoods(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'view' check (role in ('admin', 'edit', 'view')),
  address text,
  joined_at timestamptz not null default now(),
  primary key (neighborhood_id, user_id)
);

create index if not exists neighborhood_members_user_idx
  on public.neighborhood_members (user_id, neighborhood_id);

alter table public.neighborhood_members enable row level security;
grant select on public.neighborhood_members to authenticated;
grant select, insert, update, delete on public.neighborhood_members to service_role;

create or replace function public.is_current_neighborhood_member(p_neighborhood_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.neighborhoods n
    left join public.neighborhood_members m
      on m.neighborhood_id = n.id and m.user_id = (select auth.uid())
    where n.id = p_neighborhood_id
      and (n.owner_id = (select auth.uid()) or m.user_id is not null)
  );
$$;

revoke all on function public.is_current_neighborhood_member(uuid) from public;
grant execute on function public.is_current_neighborhood_member(uuid) to authenticated;

drop policy if exists "Members view neighborhood memberships" on public.neighborhood_members;
create policy "Members view neighborhood memberships"
on public.neighborhood_members for select to authenticated
using (public.is_current_neighborhood_member(neighborhood_id));

drop policy if exists "Owners see neighborhoods" on public.neighborhoods;
drop policy if exists "Neighborhood members see neighborhoods" on public.neighborhoods;
create policy "Neighborhood members see neighborhoods"
on public.neighborhoods for select to authenticated
using (owner_id = (select auth.uid()) or public.is_current_neighborhood_member(id));

create or replace function public.can_view_neighborhood_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with parsed as (
    select case
      when split_part(p_name, '/', 2) = 'neighborhoods'
       and split_part(p_name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 3)::uuid
      else null
    end as neighborhood_id
  )
  select exists (
    select 1 from parsed
    where neighborhood_id is not null
      and public.is_current_neighborhood_member(neighborhood_id)
  );
$$;

revoke all on function public.can_view_neighborhood_file(text) from public;
grant execute on function public.can_view_neighborhood_file(text) to authenticated;

drop policy if exists "Family members view shared files" on storage.objects;
create policy "Members view permitted files"
on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or public.can_view_family_document_file(name)
    or public.can_view_neighborhood_file(name)
  )
);
