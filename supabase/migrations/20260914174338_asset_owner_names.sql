-- Store only the owner's display name with shared assets; profiles remain private.
create schema if not exists private;
revoke all on schema private from public;

-- Profile saves use INSERT ... ON CONFLICT UPDATE and need both policies.
create policy "Insert own profile" on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create or replace function private.set_asset_owner_name()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_name text;
begin
  select coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.details->'profile'->>'name'), ''))
    into owner_name from public.profiles p where p.id = new.owner_id;
  new.details := coalesce(new.details, '{}'::jsonb) - 'ownerName';
  if owner_name is not null then
    new.details := jsonb_set(new.details, '{ownerName}', to_jsonb(owner_name));
  end if;
  return new;
end;
$$;
revoke all on function private.set_asset_owner_name() from public, anon, authenticated;

create trigger homes_owner_name before insert or update on public.homes
for each row execute function private.set_asset_owner_name();
create trigger vehicles_owner_name before insert or update on public.vehicles
for each row execute function private.set_asset_owner_name();

-- This trigger propagates only the changed user's name to their existing assets.
create or replace function private.refresh_asset_owner_names()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.homes set details = details where owner_id = new.id;
  update public.vehicles set details = details where owner_id = new.id;
  return new;
end;
$$;
revoke all on function private.refresh_asset_owner_names() from public, anon, authenticated;
create trigger profiles_asset_owner_names after insert or update of display_name, details on public.profiles
for each row execute function private.refresh_asset_owner_names();

-- Fill names on existing assets from the authoritative profile records.
update public.homes set details = details;
update public.vehicles set details = details;
;
