-- Run in Supabase SQL Editor.
-- Organizer ratings: one rating per (event, rater). 1..5 stars.
-- NOTE: event_id is bigint to match existing public.events.id type.

create table if not exists public.organizer_ratings (
    id uuid primary key default gen_random_uuid(),
    event_id bigint not null references public.events (id) on delete cascade,
    organizer_id uuid not null references public.profiles (id) on delete cascade,
    rater_id uuid not null references public.profiles (id) on delete cascade,
    rating smallint not null check (rating between 1 and 5),
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (event_id, rater_id)
);

create index if not exists idx_ratings_organizer on public.organizer_ratings (organizer_id);
create index if not exists idx_ratings_event on public.organizer_ratings (event_id);
create index if not exists idx_ratings_rater on public.organizer_ratings (rater_id);

alter table public.organizer_ratings enable row level security;

-- Public read so the client can show aggregates/averages.
create policy "ratings_select_public"
    on public.organizer_ratings for select
    using (true);

-- Only the rater can insert their own row (server enforces: joined, event passed, not self).
create policy "ratings_insert_self"
    on public.organizer_ratings for insert
    to authenticated
    with check (auth.uid() = rater_id);

-- Only the rater can update/delete their own row.
create policy "ratings_update_self"
    on public.organizer_ratings for update
    to authenticated
    using (auth.uid() = rater_id)
    with check (auth.uid() = rater_id);

create policy "ratings_delete_self"
    on public.organizer_ratings for delete
    to authenticated
    using (auth.uid() = rater_id);
