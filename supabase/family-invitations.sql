create table if not exists public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('Member', 'Viewer')),
  status text not null default 'sending' check (status in ('sending','pending','accepted','cancelled','failed')),
  member_profile jsonb not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  sent_at timestamptz,
  accepted_at timestamptz
);
create unique index if not exists family_invitation_live_email on public.family_invitations(inviter_id, lower(email)) where status in ('sending','pending','accepted');
alter table public.family_invitations enable row level security;
revoke all on public.family_invitations from anon, authenticated;
grant all on public.family_invitations to service_role;

-- Called only by the authenticated Edge Function. Serializes send reservations.
create or replace function public.reserve_family_invitation(p_inviter uuid, p_email text, p_name text, p_role text, p_limit integer)
returns public.family_invitations language plpgsql security definer set search_path = '' as $$
declare invitation public.family_invitations;
begin
  perform pg_advisory_xact_lock(934771);
  if (select count(*) from public.family_invitations where created_at > now() - interval '1 hour') >= greatest(1,least(p_limit,100)) then
    raise exception 'Invitation email limit reached. Please try again later.';
  end if;
  insert into public.family_invitations(inviter_id,email,name,role)
  values(p_inviter,lower(trim(p_email)),p_name,p_role) returning * into invitation;
  return invitation;
end $$;

create or replace function public.accept_family_invitation(p_id uuid, p_user uuid, p_email text)
returns public.family_invitations language plpgsql security definer set search_path = '' as $$
declare invitation public.family_invitations;
begin
  select * into invitation from public.family_invitations where id = p_id for update;
  if invitation.id is null or lower(invitation.email) <> lower(p_email) then
    raise exception 'Invitation not found for your email address.';
  end if;
  if invitation.status = 'accepted' and invitation.recipient_id = p_user then return invitation; end if;
  if invitation.status <> 'pending' or invitation.expires_at <= now() then
    raise exception 'This invitation is no longer valid. Ask for a new invitation.';
  end if;
  update public.family_invitations set status='accepted', recipient_id=p_user, accepted_at=now(),
    member_profile=coalesce((select details->'profile' from public.profiles where id=p_user),'{}'::jsonb)
    where id=p_id returning * into invitation;
  return invitation;
end $$;
revoke all on function public.reserve_family_invitation(uuid,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.accept_family_invitation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_family_invitation(uuid,text,text,text,integer) to service_role;
grant execute on function public.accept_family_invitation(uuid,uuid,text) to service_role;
