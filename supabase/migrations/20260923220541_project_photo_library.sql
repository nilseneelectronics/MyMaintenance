alter table public.asset_photos
    drop constraint if exists asset_photos_asset_type_check;

alter table public.asset_photos
    add constraint asset_photos_asset_type_check
    check (asset_type in ('home', 'vehicle', 'project'));
