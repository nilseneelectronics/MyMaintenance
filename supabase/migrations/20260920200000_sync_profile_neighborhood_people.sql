-- Keep resident snapshots in neighborhoods.details aligned with profiles.

create or replace function public.sync_profile_to_neighborhood_people()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_email text := case when tg_op = 'UPDATE' then lower(coalesce(old.details #>> '{profile,email}', '')) else '' end;
  new_email text := lower(coalesce(new.details #>> '{profile,email}', ''));
  profile_name text := coalesce(new.details #>> '{profile,name}', new.display_name, '');
  profile_phone text := coalesce(new.details #>> '{profile,phone}', '');
begin
  update public.neighborhoods n
  set details = jsonb_set(
    coalesce(n.details, '{}'::jsonb),
    '{addresses}',
    coalesce((
      select jsonb_agg(
        address || jsonb_build_object(
          'people', coalesce((
            select jsonb_agg(
              case
                when person->>'userId' = new.id::text
                  or (old_email <> '' and lower(coalesce(person->>'email', '')) = old_email)
                  or (new_email <> '' and lower(coalesce(person->>'email', '')) = new_email)
                then person || jsonb_build_object(
                  'userId', new.id::text,
                  'name', profile_name,
                  'email', new_email,
                  'phone', profile_phone
                )
                else person
              end
            )
            from jsonb_array_elements(coalesce(address->'people', '[]'::jsonb)) person
          ), '[]'::jsonb)
        )
      )
      from jsonb_array_elements(coalesce(n.details->'addresses', '[]'::jsonb)) address
    ), '[]'::jsonb),
    true
  )
  where n.details ? 'addresses';

  return new;
end;
$$;

drop trigger if exists sync_profile_to_neighborhood_people on public.profiles;
create trigger sync_profile_to_neighborhood_people
after insert or update of display_name, details on public.profiles
for each row execute function public.sync_profile_to_neighborhood_people();
