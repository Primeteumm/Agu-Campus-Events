-- Add user_roles table to Supabase
-- Run this in Supabase SQL Editor

create table if not exists public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (id) on delete cascade,
    role text not null check (role in ('student', 'teacher', 'club_member', 'club_vice_president', 'club_president')),
    assigned_at timestamptz default now(),
    unique (user_id, role)
);

create index if not exists idx_user_roles_user on public.user_roles (user_id);
create index if not exists idx_user_roles_role on public.user_roles (role);

alter table public.user_roles enable row level security;

create policy "user_roles_select_own"
    on public.user_roles for select
    using (auth.uid() = user_id);

create policy "user_roles_select_authenticated"
    on public.user_roles for select
    to authenticated
    using (true);

create policy "user_roles_insert_own"
    on public.user_roles for insert
    with check (auth.uid() = user_id);

create policy "user_roles_delete_own"
    on public.user_roles for delete
    using (auth.uid() = user_id);
