-- Shared-family ownership, registration tracking, and RLS.
-- Apply only after deploying the matching family-invitations Edge Function.

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('Owner', 'Member', 'Viewer')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id),
  unique (user_id)
);

create index if not exists family_members_family_user_idx on public.family_members (family_id, user_id);

-- This helper is deliberately scoped to the caller's own membership.  It is
-- used by RLS policies so they can check a family without recursive policies.
create or replace function public.is_current_family_member(p_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id and user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_current_family_member(uuid) from public;
grant execute on function public.is_current_family_member(uuid) to authenticated;

create or replace function public.is_family_member(p_family_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.family_members where family_id = p_family_id and user_id = p_user_id);
$$;
revoke all on function public.is_family_member(uuid, uuid) from public;
grant execute on function public.is_family_member(uuid, uuid) to authenticated;

alter table public.family_invitations add column if not exists family_id uuid references public.families(id) on delete cascade;
alter table public.homes add column if not exists family_id uuid references public.families(id) on delete set null;
alter table public.vehicles add column if not exists family_id uuid references public.families(id) on delete set null;
alter table public.documents add column if not exists family_id uuid references public.families(id) on delete set null;
alter table public.homes add column if not exists registered_by uuid references auth.users(id) on delete set null;
alter table public.vehicles add column if not exists registered_by uuid references auth.users(id) on delete set null;
alter table public.documents add column if not exists registered_by uuid references auth.users(id) on delete set null;

update public.homes set registered_by = owner_id where registered_by is null;
update public.vehicles set registered_by = owner_id where registered_by is null;
update public.documents set registered_by = owner_id where registered_by is null;
alter table public.homes alter column registered_by set default auth.uid(), alter column registered_by set not null;
alter table public.vehicles alter column registered_by set default auth.uid(), alter column registered_by set not null;
alter table public.documents alter column registered_by set default auth.uid(), alter column registered_by set not null;

create index if not exists homes_family_id_idx on public.homes (family_id);
create index if not exists vehicles_family_id_idx on public.vehicles (family_id);
create index if not exists documents_family_id_idx on public.documents (family_id);
create index if not exists documents_file_path_idx on public.documents (file_path) where file_path is not null;
create index if not exists family_invitations_family_id_idx on public.family_invitations (family_id);

-- Backfill one family per existing inviter and keep accepted recipients with
-- their inviter. New invitations are assigned to a family by the Edge Function.
insert into public.families (created_by)
select distinct inviter_id from public.family_invitations
on conflict do nothing;
insert into public.family_members (family_id, user_id, role)
select f.id, f.created_by, 'Owner' from public.families f
on conflict (user_id) do nothing;
update public.family_invitations i set family_id = f.id
from public.families f where i.family_id is null and i.inviter_id = f.created_by;
insert into public.family_members (family_id, user_id, role, joined_at)
select i.family_id, i.recipient_id, i.role, coalesce(i.accepted_at, now())
from public.family_invitations i
where i.status = 'accepted' and i.recipient_id is not null and i.family_id is not null
on conflict (user_id) do nothing;
update public.homes h set family_id = m.family_id from public.family_members m where h.owner_id = m.user_id and h.family_id is null;
update public.vehicles v set family_id = m.family_id from public.family_members m where v.owner_id = m.user_id and v.family_id is null;
update public.documents d set family_id = coalesce(h.family_id, v.family_id)
from public.homes h full join public.vehicles v on false
where d.family_id is null and (d.home_id = h.id or d.vehicle_id = v.id);

create or replace function public.assign_family_asset()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.registered_by := coalesce(new.registered_by, auth.uid());
  else new.registered_by := old.registered_by;
  end if;
  select family_id into new.family_id from public.family_members where user_id = new.owner_id;
  return new;
end;
$$;

drop trigger if exists homes_assign_family on public.homes;
create trigger homes_assign_family before insert or update of owner_id on public.homes for each row execute function public.assign_family_asset();
drop trigger if exists vehicles_assign_family on public.vehicles;
create trigger vehicles_assign_family before insert or update of owner_id on public.vehicles for each row execute function public.assign_family_asset();

create or replace function public.assign_document_family()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.registered_by := coalesce(new.registered_by, auth.uid());
  else new.registered_by := old.registered_by;
  end if;
  select family_id into new.family_id from public.homes where id = new.home_id;
  if new.family_id is null then select family_id into new.family_id from public.vehicles where id = new.vehicle_id; end if;
  return new;
end;
$$;
drop trigger if exists documents_assign_family on public.documents;
create trigger documents_assign_family before insert or update of home_id, vehicle_id on public.documents for each row execute function public.assign_document_family();

drop policy if exists "Own homes" on public.homes;
drop policy if exists "Own vehicles" on public.vehicles;
drop policy if exists "Own documents" on public.documents;
create policy "Family members manage homes" on public.homes for all to authenticated
  using (owner_id = (select auth.uid()) or public.is_current_family_member(family_id))
  with check (owner_id = (select auth.uid()) or (family_id is not null and public.is_current_family_member(family_id) and public.is_family_member(family_id, owner_id)));
create policy "Family members manage vehicles" on public.vehicles for all to authenticated
  using (owner_id = (select auth.uid()) or public.is_current_family_member(family_id))
  with check (owner_id = (select auth.uid()) or (family_id is not null and public.is_current_family_member(family_id) and public.is_family_member(family_id, owner_id)));
create policy "Family members manage documents" on public.documents for all to authenticated
  using (owner_id = (select auth.uid()) or public.is_current_family_member(family_id))
  with check (owner_id = (select auth.uid()) or (family_id is not null and public.is_current_family_member(family_id)));

alter table public.families enable row level security;
alter table public.family_members enable row level security;
grant select on public.families, public.family_members to authenticated;
create policy "Members view their family" on public.families for select to authenticated using (public.is_current_family_member(id));
create policy "Members view family members" on public.family_members for select to authenticated using (public.is_current_family_member(family_id));

create or replace function public.can_view_family_document_file(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documents d
    where d.file_path = p_name
      and (d.owner_id = (select auth.uid()) or public.is_current_family_member(d.family_id))
  );
$$;
revoke all on function public.can_view_family_document_file(text) from public;
grant execute on function public.can_view_family_document_file(text) to authenticated;
drop policy if exists "Users view own files" on storage.objects;
create policy "Family members view shared files" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.can_view_family_document_file(name));
