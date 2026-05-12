-- Drop the existing role check constraint and recreate it with Super Admin included.
-- Run this in Supabase SQL Editor before creating a Super Admin account.

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check CHECK (
        role IN (
            'Student',
            'Organizer',
            'Club Member',
            'Club Vice President',
            'Club President',
            'Super Admin'
        )
    );
