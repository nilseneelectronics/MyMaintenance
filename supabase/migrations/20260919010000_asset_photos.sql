-- User photos for homes and vehicles.
-- The image bytes live in the authenticated documents bucket; this table stores
-- the asset link, storage path, and caption.

create table if not exists public.asset_photos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    asset_id text not null,
    asset_type text not null,
    storage_path text not null,
    caption text not null default '',
    created_at timestamptz not null default now(),
    constraint asset_photos_asset_type_check check (asset_type in ('home', 'vehicle')),
    constraint asset_photos_asset_id_not_blank check (length(trim(asset_id)) > 0),
    constraint asset_photos_storage_path_not_blank check (length(trim(storage_path)) > 0)
);

create index if not exists asset_photos_user_asset_idx
    on public.asset_photos(user_id, asset_type, asset_id, created_at);

alter table public.asset_photos enable row level security;

drop policy if exists "Users can read own asset photos" on public.asset_photos;
create policy "Users can read own asset photos"
    on public.asset_photos for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own asset photos" on public.asset_photos;
create policy "Users can insert own asset photos"
    on public.asset_photos for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own asset photos" on public.asset_photos;
create policy "Users can update own asset photos"
    on public.asset_photos for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete own asset photos" on public.asset_photos;
create policy "Users can delete own asset photos"
    on public.asset_photos for delete
    using (auth.uid() = user_id);

drop policy if exists "Users can upload own asset photos" on storage.objects;
create policy "Users can upload own asset photos"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'documents'
        and (storage.foldername(name))[1] = (auth.uid())::text
        and (storage.foldername(name))[2] = 'photos'
    );

drop policy if exists "Users can read own asset photo files" on storage.objects;
create policy "Users can read own asset photo files"
    on storage.objects for select to authenticated
    using (
        bucket_id = 'documents'
        and (storage.foldername(name))[1] = (auth.uid())::text
        and (storage.foldername(name))[2] = 'photos'
    );

drop policy if exists "Users can update own asset photo files" on storage.objects;
create policy "Users can update own asset photo files"
    on storage.objects for update to authenticated
    using (
        bucket_id = 'documents'
        and (storage.foldername(name))[1] = (auth.uid())::text
        and (storage.foldername(name))[2] = 'photos'
    )
    with check (
        bucket_id = 'documents'
        and (storage.foldername(name))[1] = (auth.uid())::text
        and (storage.foldername(name))[2] = 'photos'
    );

drop policy if exists "Users can delete own asset photo files" on storage.objects;
create policy "Users can delete own asset photo files"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'documents'
        and (storage.foldername(name))[1] = (auth.uid())::text
        and (storage.foldername(name))[2] = 'photos'
    );
