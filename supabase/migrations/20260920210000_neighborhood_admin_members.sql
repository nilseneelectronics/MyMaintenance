-- Admin-only membership changes for neighborhood residents.

create or replace function public.admin_move_neighborhood_member(
  p_neighborhood_id uuid,
  p_user_id uuid,
  p_address text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.neighborhoods
    where id = p_neighborhood_id and owner_id = (select auth.uid())
  ) then
    raise exception 'Only the neighborhood admin can move residents.';
  end if;
  update public.neighborhood_members
  set address = nullif(trim(p_address), '')
  where neighborhood_id = p_neighborhood_id and user_id = p_user_id;
end;
$$;

create or replace function public.admin_remove_neighborhood_member(
  p_neighborhood_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.neighborhoods
    where id = p_neighborhood_id and owner_id = (select auth.uid())
  ) then
    raise exception 'Only the neighborhood admin can remove residents.';
  end if;
  insert into public.notifications(recipient_id, kind, reference_id, title, body)
  values (p_user_id, 'system', p_neighborhood_id, 'Neighborhood access removed', 'Your access to this neighborhood has been removed by its administrator.');
  delete from public.neighborhood_members
  where neighborhood_id = p_neighborhood_id and user_id = p_user_id;
end;
$$;

revoke all on function public.admin_move_neighborhood_member(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_remove_neighborhood_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_move_neighborhood_member(uuid, uuid, text) to authenticated;
grant execute on function public.admin_remove_neighborhood_member(uuid, uuid) to authenticated;

create or replace function public.admin_move_neighborhood_invitee(
  p_neighborhood_id uuid,
  p_email text,
  p_address text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.neighborhoods
    where id = p_neighborhood_id and owner_id = (select auth.uid())
  ) then
    raise exception 'Only the neighborhood admin can move pending invites.';
  end if;
  update public.neighborhood_invitations
  set address = nullif(trim(p_address), '')
  where neighborhood_id = p_neighborhood_id
    and lower(email) = lower(trim(p_email))
    and status = 'pending';
end;
$$;

revoke all on function public.admin_move_neighborhood_invitee(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_move_neighborhood_invitee(uuid, text, text) to authenticated;

-- Normalize deployments that still have the pre-invitation role constraint.
alter table public.neighborhood_members
  drop constraint if exists neighborhood_members_role_check;
update public.neighborhood_members
set role = case role when 'owner' then 'admin' when 'member' then 'edit' else role end
where role in ('owner', 'member');
alter table public.neighborhood_members
  add constraint neighborhood_members_role_check check (role in ('admin', 'edit', 'view'));
