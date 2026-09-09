-- Run once in Supabase: SQL Editor.
-- Keeps the existing neighborhoods/member tables and policies intact.

alter table public.neighborhoods
  add column if not exists details jsonb not null default '{}'::jsonb;

-- The app sends owner_id from the signed-in user. Keep the existing owner
-- insert/update rule, and let owners load/delete their own neighborhood.
drop policy if exists "Users can create neighborhoods" on public.neighborhoods;

create policy "Owners see neighborhoods"
on public.neighborhoods
for select
to authenticated
using (owner_id = auth.uid());

create policy "Owners delete neighborhoods"
on public.neighborhoods
for delete
to authenticated
using (owner_id = auth.uid());
