-- Open to-do list and completed tasks, scoped per signed-in user.
-- Run once in Supabase: SQL Editor.

create table if not exists public.planning_todos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.planning_done_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null,
  done_at date not null,
  asset text not null default '',
  equipment text not null default '',
  comments text not null default '',
  time text not null default '',
  cost text not null default '',
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists planning_todos_owner_idx on public.planning_todos (owner_id);
create index if not exists planning_done_tasks_owner_idx on public.planning_done_tasks (owner_id);

alter table public.planning_todos enable row level security;
alter table public.planning_done_tasks enable row level security;

create policy "Own planning todos" on public.planning_todos
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Own planning done tasks" on public.planning_done_tasks
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.planning_todos to authenticated;
grant select, insert, update, delete on public.planning_done_tasks to authenticated;