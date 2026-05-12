-- SuperAdmin schema: clubs and club_memberships tables

-- clubs table
CREATE TABLE IF NOT EXISTS public.clubs (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT        NOT NULL,
    description TEXT,
    logo_url    TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- club_memberships: user-to-club role assignments (separate from profiles.role)
CREATE TABLE IF NOT EXISTS public.club_memberships (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id     UUID        NOT NULL REFERENCES public.clubs(id)    ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    club_role   TEXT        NOT NULL CHECK (club_role IN ('president', 'vice_president', 'member')),
    assigned_by UUID        REFERENCES public.profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(club_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_club_memberships_club_id ON public.club_memberships(club_id);
CREATE INDEX IF NOT EXISTS idx_club_memberships_user_id ON public.club_memberships(user_id);

-- RLS
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;

-- Public read for clubs and memberships
CREATE POLICY "clubs_public_read"       ON public.clubs            FOR SELECT USING (true);
CREATE POLICY "memberships_public_read" ON public.club_memberships FOR SELECT USING (true);

-- Only service role (superadmin backend) can insert/update/delete
-- Frontend never writes directly; all mutations go through the API with service role key.
