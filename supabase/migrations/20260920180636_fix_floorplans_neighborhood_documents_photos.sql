revoke select, insert, update, delete on public.projects from anon;
revoke select, insert, update, delete on public.floorplans from anon;
revoke select, insert, update, delete on public.asset_photos from anon;

grant select, insert, update, delete on public.projects to authenticated, service_role;
grant select, insert, update, delete on public.floorplans to authenticated, service_role;
grant select, insert, update, delete on public.asset_photos to authenticated, service_role;

drop policy if exists "Users can read own projects" on public.projects;
create policy "Users can read own projects" on public.projects for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own projects" on public.projects;
create policy "Users can insert own projects" on public.projects for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects" on public.projects for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects" on public.projects for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own floorplans" on public.floorplans;
create policy "Users can read own floorplans" on public.floorplans for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own floorplans" on public.floorplans;
create policy "Users can insert own floorplans" on public.floorplans for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own floorplans" on public.floorplans;
create policy "Users can update own floorplans" on public.floorplans for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own floorplans" on public.floorplans;
create policy "Users can delete own floorplans" on public.floorplans for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own asset photos" on public.asset_photos;
create policy "Users can read own asset photos" on public.asset_photos for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own asset photos" on public.asset_photos;
create policy "Users can insert own asset photos" on public.asset_photos for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own asset photos" on public.asset_photos;
create policy "Users can update own asset photos" on public.asset_photos for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own asset photos" on public.asset_photos;
create policy "Users can delete own asset photos" on public.asset_photos for delete to authenticated
using ((select auth.uid()) = user_id);

alter table public.documents
add column if not exists neighborhood_id uuid references public.neighborhoods(id) on delete cascade;

create index if not exists documents_neighborhood_id_idx
on public.documents (neighborhood_id);

update public.neighborhoods n
set details = jsonb_set(
  n.details,
  '{docs}',
  coalesce((
    select jsonb_agg(
      case
        when coalesce(d.item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then d.item
        when coalesce(d.item->>'filePath', '') <> ''
          then d.item || jsonb_build_object(
            'id', (
              substr(md5(d.item->>'filePath'), 1, 8) || '-'
              || substr(md5(d.item->>'filePath'), 9, 4) || '-4'
              || substr(md5(d.item->>'filePath'), 14, 3) || '-a'
              || substr(md5(d.item->>'filePath'), 18, 3) || '-'
              || substr(md5(d.item->>'filePath'), 21, 12)
            )::uuid
          )
        else d.item
      end
      order by d.position
    )
    from jsonb_array_elements(coalesce(n.details->'docs', '[]'::jsonb)) with ordinality d(item, position)
  ), '[]'::jsonb),
  true
)
where jsonb_typeof(n.details->'docs') = 'array';

update public.documents d
set neighborhood_id = n.id
from public.neighborhoods n
where d.neighborhood_id is null
  and split_part(coalesce(d.file_path, ''), '/', 2) = 'neighborhoods'
  and split_part(d.file_path, '/', 3) = n.id::text;

insert into public.documents (
  id, owner_id, registered_by, neighborhood_id, title, document_type,
  file_path, document_date, extracted_data
)
select
  (item->>'id')::uuid,
  n.owner_id,
  n.owner_id,
  n.id,
  coalesce(nullif(item->>'name', ''), nullif(item->>'fileName', ''), 'Document'),
  nullif(item->>'docType', ''),
  item->>'filePath',
  case
    when coalesce(item->>'performed', '') ~ '^\d{4}-\d{2}-\d{2}'
      then substring(item->>'performed' from 1 for 10)::date
    else null
  end,
  item
from public.neighborhoods n
cross join lateral jsonb_array_elements(coalesce(n.details->'docs', '[]'::jsonb)) item
where coalesce(item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and coalesce(item->>'filePath', '') <> ''
  and not exists (
    select 1 from public.documents existing
    where existing.id = (item->>'id')::uuid
       or existing.file_path = item->>'filePath'
  );

alter table public.documents
drop constraint if exists documents_single_asset_check;
alter table public.documents
add constraint documents_single_asset_check
check (num_nonnulls(home_id, vehicle_id, neighborhood_id) <= 1);

drop policy if exists "Family members manage documents" on public.documents;
drop policy if exists "Members read documents" on public.documents;
drop policy if exists "Editors insert documents" on public.documents;
drop policy if exists "Editors update documents" on public.documents;
drop policy if exists "Editors delete documents" on public.documents;

create policy "Members read documents" on public.documents for select to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_current_family_member(family_id)
  or (
    public.is_current_neighborhood_member(neighborhood_id)
    and coalesce(extracted_data->>'privacy', 'neighborhood') = 'neighborhood'
  )
);

create policy "Editors insert documents" on public.documents for insert to authenticated
with check (
  owner_id = (select auth.uid())
  or (family_id is not null and public.is_current_family_member(family_id))
  or public.is_current_neighborhood_editor(neighborhood_id)
);

create policy "Editors update documents" on public.documents for update to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_current_family_member(family_id)
  or public.is_current_neighborhood_editor(neighborhood_id)
)
with check (
  owner_id = (select auth.uid())
  or (family_id is not null and public.is_current_family_member(family_id))
  or public.is_current_neighborhood_editor(neighborhood_id)
);

create policy "Editors delete documents" on public.documents for delete to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_current_family_member(family_id)
  or public.is_current_neighborhood_editor(neighborhood_id)
);

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
    select 1
    from parsed
    where neighborhood_id is not null
      and public.is_current_neighborhood_member(neighborhood_id)
      and (
        split_part(p_name, '/', 4) <> 'documents'
        or exists (
          select 1
          from public.documents d
          where d.file_path = p_name
            and d.neighborhood_id = parsed.neighborhood_id
            and (
              d.owner_id = (select auth.uid())
              or coalesce(d.extracted_data->>'privacy', 'neighborhood') = 'neighborhood'
            )
        )
      )
  );
$$;

revoke all on function public.can_view_neighborhood_file(text) from public;
grant execute on function public.can_view_neighborhood_file(text) to authenticated;
