grant select, insert on public.families to service_role;
grant select, insert on public.family_members to service_role;
grant select, update on public.homes to service_role;
grant select, update on public.vehicles to service_role;
grant select, update on public.neighborhoods to service_role;

alter table public.neighborhood_members
  add column if not exists address text;

alter table public.neighborhood_members
  drop constraint if exists neighborhood_members_role_check;

update public.neighborhood_members
set role = case role when 'owner' then 'admin' when 'member' then 'edit' else role end
where role in ('owner', 'member');

alter table public.neighborhood_members
  alter column role set default 'view',
  add constraint neighborhood_members_role_check check (role in ('admin', 'edit', 'view'));

notify pgrst, 'reload schema';
