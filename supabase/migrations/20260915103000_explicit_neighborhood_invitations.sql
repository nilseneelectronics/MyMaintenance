-- Neighborhood sharing is explicit. Matching addresses do not grant access.
-- Accepted invitees can contribute neighborhood content and may invite only
-- active members of their own family (enforced by the invitation function).

create table if not exists public.neighborhood_invitations (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  address text,
  status text not null default 'sending' check (status in ('sending', 'pending', 'accepted', 'cancelled', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  sent_at timestamptz,
  accepted_at timestamptz
);

create unique index if not exists neighborhood_invitation_live_email
  on public.neighborhood_invitations (neighborhood_id, lower(email))
  where status in ('sending', 'pending');

alter table public.neighborhood_invitations enable row level security;
revoke all on public.neighborhood_invitations from anon, authenticated;
grant all on public.neighborhood_invitations to service_role;

create or replace function public.is_current_neighborhood_editor(p_neighborhood_id uuid)
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
      and (n.owner_id = (select auth.uid()) or m.role in ('admin', 'edit'))
  );
$$;

revoke all on function public.is_current_neighborhood_editor(uuid) from public;
grant execute on function public.is_current_neighborhood_editor(uuid) to authenticated;

drop policy if exists "Neighborhood editors update neighborhoods" on public.neighborhoods;
create policy "Neighborhood editors update neighborhoods"
on public.neighborhoods for update to authenticated
using (public.is_current_neighborhood_editor(id))
with check (public.is_current_neighborhood_editor(id));

create or replace function public.protect_neighborhood_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner_id is distinct from old.owner_id and old.owner_id <> (select auth.uid()) then
    raise exception 'Only the neighborhood owner can transfer ownership.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_neighborhood_ownership on public.neighborhoods;
create trigger protect_neighborhood_ownership
before update of owner_id on public.neighborhoods
for each row execute function public.protect_neighborhood_ownership();

create or replace function public.can_edit_neighborhood_file(p_name text)
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
      and public.is_current_neighborhood_editor(neighborhood_id)
  );
$$;

revoke all on function public.can_edit_neighborhood_file(text) from public;
grant execute on function public.can_edit_neighborhood_file(text) to authenticated;

drop policy if exists "Neighborhood editors upload files" on storage.objects;
create policy "Neighborhood editors upload files"
on storage.objects for insert to authenticated
with check (bucket_id = 'documents' and public.can_edit_neighborhood_file(name));

drop policy if exists "Neighborhood editors update files" on storage.objects;
create policy "Neighborhood editors update files"
on storage.objects for update to authenticated
using (bucket_id = 'documents' and public.can_edit_neighborhood_file(name))
with check (bucket_id = 'documents' and public.can_edit_neighborhood_file(name));

drop policy if exists "Neighborhood editors delete files" on storage.objects;
create policy "Neighborhood editors delete files"
on storage.objects for delete to authenticated
using (bucket_id = 'documents' and public.can_edit_neighborhood_file(name));

create or replace function public.reserve_neighborhood_invitation(
  p_neighborhood uuid, p_inviter uuid, p_recipient uuid, p_email text,
  p_name text, p_address text
)
returns public.neighborhood_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare invitation public.neighborhood_invitations;
begin
  perform pg_advisory_xact_lock(934772);
  insert into public.neighborhood_invitations(
    neighborhood_id, inviter_id, recipient_id, email, name, address
  ) values (
    p_neighborhood, p_inviter, p_recipient, lower(trim(p_email)), p_name, nullif(trim(p_address), '')
  ) returning * into invitation;
  return invitation;
end;
$$;

create or replace function public.accept_neighborhood_invitation(
  p_id uuid, p_user uuid, p_email text
)
returns public.neighborhood_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare invitation public.neighborhood_invitations;
begin
  select * into invitation
  from public.neighborhood_invitations
  where id = p_id
  for update;

  if invitation.id is null or lower(invitation.email) <> lower(p_email) then
    raise exception 'Neighborhood invitation not found for your email address.';
  end if;
  if invitation.status = 'accepted' and invitation.recipient_id = p_user then
    return invitation;
  end if;
  if invitation.status <> 'pending' or invitation.expires_at <= now() then
    raise exception 'This neighborhood invitation is no longer valid. Ask for a new invitation.';
  end if;

  update public.neighborhood_invitations
  set status = 'accepted', recipient_id = p_user, accepted_at = now()
  where id = p_id
  returning * into invitation;

  insert into public.neighborhood_members(neighborhood_id, user_id, role, address)
  values (invitation.neighborhood_id, p_user, 'edit', invitation.address)
  on conflict (neighborhood_id, user_id)
  do update set role = 'edit', address = excluded.address;

  return invitation;
end;
$$;

revoke all on function public.reserve_neighborhood_invitation(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.accept_neighborhood_invitation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_neighborhood_invitation(uuid, uuid, uuid, text, text, text) to service_role;
grant execute on function public.accept_neighborhood_invitation(uuid, uuid, text) to service_role;

-- Preserve existing memberships and resident rows. Automatic address matching
-- has been removed from the function, so every new membership is invitation-based.
