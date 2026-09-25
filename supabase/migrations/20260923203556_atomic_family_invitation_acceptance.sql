create or replace function public.accept_family_invitation(p_id uuid, p_user uuid, p_email text)
returns public.family_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.family_invitations;
  membership public.family_members;
  previous_family uuid;
  member_count integer;
begin
  select * into invitation from public.family_invitations where id = p_id for update;
  if invitation.id is null or lower(invitation.email) <> lower(p_email) then
    raise exception 'Invitation not found for your email address.';
  end if;
  if invitation.family_id is null then
    raise exception 'This invitation is missing its family.';
  end if;
  if not (invitation.status = 'accepted' and invitation.recipient_id = p_user)
    and (invitation.status <> 'pending' or invitation.expires_at <= now()) then
    raise exception 'This invitation is no longer valid. Ask for a new invitation.';
  end if;
  select * into membership from public.family_members where user_id = p_user for update;
  if membership.user_id is null then
    insert into public.family_members(family_id,user_id,role)
    values(invitation.family_id,p_user,invitation.role);
  elsif membership.family_id <> invitation.family_id then
    previous_family := membership.family_id;
    select count(*) into member_count from public.family_members where family_id = previous_family;
    if membership.role <> 'Owner' or member_count <> 1 then
      raise exception 'You already belong to another family. Leave that family before accepting this invitation.';
    end if;
    update public.homes set family_id = invitation.family_id where family_id = previous_family;
    update public.vehicles set family_id = invitation.family_id where family_id = previous_family;
    update public.documents set family_id = invitation.family_id where family_id = previous_family;
    update public.family_members set family_id = invitation.family_id, role = invitation.role where user_id = p_user;
    delete from public.families where id = previous_family;
  end if;
  update public.family_invitations
  set status = 'accepted', recipient_id = p_user, accepted_at = coalesce(accepted_at,now()),
    member_profile = coalesce((select details->'profile' from public.profiles where id=p_user),'{}'::jsonb)
  where id = p_id
  returning * into invitation;
  return invitation;
end;
$$;

revoke all on function public.accept_family_invitation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.accept_family_invitation(uuid,uuid,text) to service_role;

notify pgrst, 'reload schema';
