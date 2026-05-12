const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();


const { supabase } = require('./supabase'); 


const app = express();


app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const userRoutes = require('./routes/userRoutes');
const superadminRoutes = require('./routes/superadminRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/superadmin', superadminRoutes);

// Public clubs list (no auth required)
app.get('/api/clubs', async (req, res) => {
    try {
        const { getSupabaseAdmin } = require('./supabase');
        const admin = getSupabaseAdmin();
        if (!admin) return res.json({ clubs: [] });
        const { data, error } = await admin
            .from('clubs')
            .select('id, name, logo_url')
            .order('name', { ascending: true });
        if (error) return res.json({ clubs: [] });
        res.json({ clubs: data || [] });
    } catch (e) {
        res.json({ clubs: [] });
    }
});

// Public club detail
app.get('/api/clubs/:id', async (req, res) => {
    try {
        const { getSupabaseAdmin } = require('./supabase');
        const admin = getSupabaseAdmin();
        if (!admin) return res.status(503).json({ error: 'unavailable' });
        const { data: club, error } = await admin
            .from('clubs')
            .select('id, name, description, logo_url')
            .eq('id', req.params.id)
            .single();
        if (error || !club) return res.status(404).json({ error: 'Not found' });
        const { count } = await admin
            .from('club_memberships')
            .select('id', { count: 'exact', head: true })
            .eq('club_id', req.params.id);
        res.json({ club: { ...club, member_count: count || 0 } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Public club members
app.get('/api/clubs/:id/members', async (req, res) => {
    try {
        const { getSupabaseAdmin } = require('./supabase');
        const admin = getSupabaseAdmin();
        if (!admin) return res.json({ members: [] });
        const { data, error } = await admin
            .from('club_memberships')
            .select('club_role, profiles:user_id(id, first_name, last_name)')
            .eq('club_id', req.params.id);
        if (error) return res.json({ members: [] });
        const members = (data || []).map(m => ({
            id: m.profiles?.id,
            name: `${m.profiles?.first_name || ''} ${m.profiles?.last_name || ''}`.trim(),
            role: m.club_role,
        }));
        res.json({ members });
    } catch (e) {
        res.json({ members: [] });
    }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);

    try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) {
            console.error('❌ Supabase bağlantı hatası:', error.message);
        } else {
            console.log('✅ Supabase bağlantısı başarılı! AGU Campus Events hazır.');
        }
    } catch (e) {
        console.error('❌ Supabase bağlantı hatası:', e.message);
    }
});

module.exports = app;