-- Run in Supabase SQL Editor (adjust policies for your security model).
-- Expected by the Node API: public.profiles, public.events, public.event_participants

-- Profiles (linked to auth.users; trigger often creates row on signup)
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    username text unique,
    email text,
    first_name text,
    last_name text,
    avatar_url text,
    roles text[] not null default array['student']::text[],
    created_at timestamptz default now()
);

-- Events
create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    date timestamptz not null,
    location text not null,
    capacity int not null default 50,
    organizer_id uuid not null references public.profiles (id) on delete cascade,
    created_at timestamptz default now()
);

-- If you prefer the column name event_date instead of date, rename in SQL Editor
-- and/or the API will try event_date on insert when date fails.

-- Participants
create table if not exists public.event_participants (
    user_id uuid not null references public.profiles (id) on delete cascade,
    event_id uuid not null references public.events (id) on delete cascade,
    joined_at timestamptz default now(),
    primary key (user_id, event_id)
);

-- User Roles
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

create index if not exists idx_events_organizer on public.events (organizer_id);
create index if not exists idx_events_date on public.events (date);
create index if not exists idx_participants_event on public.event_participants (event_id);
create index if not exists idx_participants_user on public.event_participants (user_id);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;

-- Example policies (open read on events for the app home page)
create policy "events_select_public"
    on public.events for select
    using (true);

create policy "events_insert_authenticated"
    on public.events for insert
    with check (auth.uid() = organizer_id);

create policy "events_update_own"
    on public.events for update
    using (auth.uid() = organizer_id);

create policy "events_delete_own"
    on public.events for delete
    using (auth.uid() = organizer_id);

-- Profiles: users manage their own row
create policy "profiles_select_own"
    on public.profiles for select
    using (auth.uid() = id);

create policy "profiles_update_own"
    on public.profiles for update
    using (auth.uid() = id);

-- Authenticated users can read profiles (club lookup / assign roles). Tighten for production.
create policy "profiles_select_authenticated"
    on public.profiles for select
    to authenticated
    using (true);

-- Optional: public read of organizer display names only (PII risk). Prefer SUPABASE_SERVICE_ROLE_KEY on the server instead.
-- create policy "profiles_select_public" on public.profiles for select using (true);

create policy "profiles_insert_own"
    on public.profiles for insert
    with check (auth.uid() = id);

-- Participants (public read so anon API can show counts; optional if you use SUPABASE_SERVICE_ROLE_KEY only)
create policy "participants_select_public"
    on public.event_participants for select
    using (true);

create policy "participants_select_authenticated"
    on public.event_participants for select
    to authenticated
    using (true);

create policy "participants_insert_authenticated"
    on public.event_participants for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "participants_delete_own"
    on public.event_participants for delete
    using (auth.uid() = user_id);

-- Let anonymous users resolve organizer names for the public events list (no service role required)
create policy "profiles_select_if_event_organizer"
    on public.profiles for select
    using (exists (select 1 from public.events e where e.organizer_id = profiles.id));

-- ─────────────────────────────────────────────────────────────────────────────
-- MOCK DATA (Ghost Identities for SCRUM-48)
-- Run these inserts AFTER creating a user in Supabase Auth and copying their UUID.
-- Replace 'YOUR-USER-UUID-HERE' with an actual UUID from auth.users.
-- ─────────────────────────────────────────────────────────────────────────────
/*
INSERT INTO public.profiles (id, username, first_name, last_name, roles)
VALUES 
    ('YOUR-USER-UUID-HERE', 'nebula_tech', 'Nebula Tech', 'Society', ARRAY['organizer']),
    ('YOUR-USER-UUID-HERE-2', 'echo_arts', 'Echo Arts', 'Collective', ARRAY['organizer']);

INSERT INTO public.events (title, description, date, location, capacity, organizer_id)
VALUES 
    ('The Great Syntax Run', 'A competitive algorithm challenge for students.', NOW() + INTERVAL '5 days', 'Lab 1', 100, 'YOUR-USER-UUID-HERE'),
    ('Pixel Perfect Workshop', 'Learn advanced UI/UX techniques and Figma tricks.', NOW() + INTERVAL '10 days', 'Design Studio', 40, 'YOUR-USER-UUID-HERE'),
    ('Sonic Vibes Night', 'Live electronic and jazz performances by campus artists.', NOW() + INTERVAL '2 days', 'Main Stage', 200, 'YOUR-USER-UUID-HERE-2'),
    ('Infinite Loop Hackathon', '48-hour coding marathon to solve campus problems.', NOW() + INTERVAL '15 days', 'Incubation Center', 80, 'YOUR-USER-UUID-HERE');
*/
