const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Client that acts as the signed-in user (respects RLS). Use after verifyToken with req.accessToken.
 */
function createSupabaseForToken(accessToken) {
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${accessToken}` },
        },
    });
}

/**
 * Optional: bypasses RLS for trusted server-side ops. Set SUPABASE_SERVICE_ROLE_KEY in .env.
 */
function getSupabaseAdmin() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return null;
    return createClient(supabaseUrl, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

module.exports = { supabase, createSupabaseForToken, getSupabaseAdmin };
