-- Cloud persistence for document projects and floor plans.
-- Both tables are owned by the signed-in user and protected by RLS.

create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    asset text not null,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint projects_name_not_blank check (length(trim(name)) > 0),
    constraint projects_asset_not_blank check (length(trim(asset)) > 0),
    constraint projects_user_asset_name_key unique (user_id, asset, name)
);

create index if not exists projects_user_asset_idx on public.projects(user_id, asset);

alter table public.projects enable row level security;

drop policy if exists "Users can read own projects" on public.projects;
create policy "Users can read own projects"
    on public.projects for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own projects" on public.projects;
create policy "Users can insert own projects"
    on public.projects for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
    on public.projects for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects"
    on public.projects for delete
    using (auth.uid() = user_id);

create table if not exists public.floorplans (
    id text not null,
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    name text not null,
    asset text not null default '',
    data jsonb not null default '{}'::jsonb,
    preview text not null default '',
    updated_at timestamptz not null default now(),
    constraint floorplans_id_not_blank check (length(trim(id)) > 0),
    constraint floorplans_name_not_blank check (length(trim(name)) > 0),
    primary key (user_id, id)
);

create index if not exists floorplans_user_asset_idx on public.floorplans(user_id, asset);

alter table public.floorplans enable row level security;

drop policy if exists "Users can read own floorplans" on public.floorplans;
create policy "Users can read own floorplans"
    on public.floorplans for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own floorplans" on public.floorplans;
create policy "Users can insert own floorplans"
    on public.floorplans for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own floorplans" on public.floorplans;
create policy "Users can update own floorplans"
    on public.floorplans for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete own floorplans" on public.floorplans;
create policy "Users can delete own floorplans"
    on public.floorplans for delete
    using (auth.uid() = user_id);
