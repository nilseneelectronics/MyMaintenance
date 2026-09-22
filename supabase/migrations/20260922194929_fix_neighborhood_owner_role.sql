create or replace function public.add_neighborhood_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.neighborhood_members (neighborhood_id, user_id, role)
  values (new.id, new.owner_id, 'admin')
  on conflict (neighborhood_id, user_id)
  do update set role = 'admin';
  return new;
end;
$$;

revoke all on function public.add_neighborhood_owner() from public, anon, authenticated;
