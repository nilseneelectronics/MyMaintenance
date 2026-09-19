-- Persistent notification inbox and recipient invitation rejection.

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    kind text not null,
    reference_id uuid,
    title text not null,
    body text not null default '',
    read_at timestamptz,
    created_at timestamptz not null default now(),
    constraint notifications_kind_check check (kind in ('family_invitation', 'neighborhood_invitation', 'system'))
);

alter table public.notifications add constraint notifications_invitation_unique
    unique (recipient_id, kind, reference_id);
create index if not exists notifications_recipient_created_idx
    on public.notifications(recipient_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
    on public.notifications for select
    using (auth.uid() = recipient_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
    on public.notifications for update
    using (auth.uid() = recipient_id)
    with check (auth.uid() = recipient_id);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
    on public.notifications for delete
    using (auth.uid() = recipient_id);

grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.family_invitations drop constraint if exists family_invitations_status_check;
alter table public.family_invitations add constraint family_invitations_status_check
    check (status in ('sending', 'pending', 'accepted', 'rejected', 'cancelled', 'failed'));

alter table public.neighborhood_invitations drop constraint if exists neighborhood_invitations_status_check;
alter table public.neighborhood_invitations add constraint neighborhood_invitations_status_check
    check (status in ('sending', 'pending', 'accepted', 'rejected', 'cancelled', 'failed'));
