const { getSupabaseAdmin } = require('../supabase');
const { ROLE } = require('../constants/roles');
const { roleToDisplayLabel } = require('../utils/userRoles');

function getAdminClient() {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
    return admin;
}

// ── Users ─────────────────────────────────────────────────────────────────────

// GET /api/superadmin/users
const listUsers = async (req, res) => {
    try {
        const admin = getAdminClient();

        const [{ data: profiles, error }, { data: memberships }] = await Promise.all([
            admin.from('profiles').select('id, first_name, last_name, email, role, created_at').order('created_at', { ascending: true }),
            admin.from('club_memberships').select('user_id, club_role, clubs:club_id(id, name)'),
        ]);

        if (error) return res.status(500).json({ message: 'Could not fetch users.' });

        // Build a map of userId → club membership info
        const membershipMap = {};
        for (const m of memberships || []) {
            membershipMap[m.user_id] = { clubName: m.clubs?.name || '', clubRole: m.club_role, clubId: m.clubs?.id || '' };
        }

        res.json({
            users: (profiles || []).map((u) => {
                const club = membershipMap[u.id] || null;
                return {
                    id: u.id,
                    firstName: u.first_name || '',
                    lastName: u.last_name || '',
                    email: u.email || '',
                    role: u.role || ROLE.STUDENT,
                    roleLabel: roleToDisplayLabel(u.role),
                    clubName: club?.clubName || '',
                    clubRole: club?.clubRole || '',
                    clubId: club?.clubId || '',
                };
            }),
        });
    } catch (err) {
        console.error('superadmin listUsers:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// PUT /api/superadmin/users/:id/role
const changeUserRole = async (req, res) => {
    try {
        const { id: targetUserId } = req.params;
        const { newRole } = req.body;

        if (!newRole) return res.status(400).json({ message: 'newRole is required.' });
        if (targetUserId === req.user.id) {
            return res.status(400).json({ message: 'You cannot change your own role.' });
        }

        const validRoles = Object.values(ROLE).filter((r) => r !== ROLE.SUPER_ADMIN);
        if (!validRoles.includes(newRole)) {
            return res.status(400).json({ message: 'Invalid role.' });
        }

        const admin = getAdminClient();
        const { data: target, error: tErr } = await admin
            .from('profiles')
            .select('id, first_name, last_name')
            .eq('id', targetUserId)
            .maybeSingle();

        if (tErr || !target) return res.status(404).json({ message: 'User not found.' });

        const { error } = await admin
            .from('profiles')
            .update({ role: newRole })
            .eq('id', targetUserId);

        if (error) return res.status(500).json({ message: 'Could not update role.' });

        const name = `${target.first_name || ''} ${target.last_name || ''}`.trim() || 'User';
        res.json({
            message: `${name} is now ${roleToDisplayLabel(newRole)}.`,
            userId: targetUserId,
            newRole,
            newRoleLabel: roleToDisplayLabel(newRole),
        });
    } catch (err) {
        console.error('superadmin changeUserRole:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// ── Clubs ─────────────────────────────────────────────────────────────────────

// GET /api/superadmin/clubs
const listClubs = async (req, res) => {
    try {
        const admin = getAdminClient();
        const { data: clubs, error } = await admin
            .from('clubs')
            .select('id, name, description, logo_url, created_at')
            .order('name', { ascending: true });

        if (error) return res.status(500).json({ message: 'Could not fetch clubs.' });
        res.json({ clubs: clubs || [] });
    } catch (err) {
        console.error('superadmin listClubs:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// POST /api/superadmin/clubs
const createClub = async (req, res) => {
    try {
        const { name, description, logo_url } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'Club name is required.' });

        const admin = getAdminClient();
        const { data, error } = await admin
            .from('clubs')
            .insert({ name: name.trim(), description: description || null, logo_url: logo_url || null })
            .select()
            .single();

        if (error) return res.status(500).json({ message: 'Could not create club.' });
        res.status(201).json({ club: data });
    } catch (err) {
        console.error('superadmin createClub:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// PUT /api/superadmin/clubs/:id
const updateClub = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, logo_url } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'Club name is required.' });

        const admin = getAdminClient();
        const { data, error } = await admin
            .from('clubs')
            .update({ name: name.trim(), description: description ?? null, logo_url: logo_url ?? null })
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(500).json({ message: 'Could not update club.' });
        if (!data) return res.status(404).json({ message: 'Club not found.' });
        res.json({ club: data });
    } catch (err) {
        console.error('superadmin updateClub:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// DELETE /api/superadmin/clubs/:id
const deleteClub = async (req, res) => {
    try {
        const { id } = req.params;
        const admin = getAdminClient();
        const { error } = await admin.from('clubs').delete().eq('id', id);
        if (error) return res.status(500).json({ message: 'Could not delete club.' });
        res.json({ message: 'Club deleted.' });
    } catch (err) {
        console.error('superadmin deleteClub:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// ── Club Memberships ──────────────────────────────────────────────────────────

// GET /api/superadmin/clubs/:id/members
const listClubMembers = async (req, res) => {
    try {
        const { id: clubId } = req.params;
        const admin = getAdminClient();

        const { data, error } = await admin
            .from('club_memberships')
            .select('id, club_role, assigned_at, user_id, profiles:user_id(first_name, last_name, email, role)')
            .eq('club_id', clubId)
            .order('assigned_at', { ascending: true });

        if (error) return res.status(500).json({ message: 'Could not fetch members.' });

        const members = (data || []).map((m) => ({
            membershipId: m.id,
            userId: m.user_id,
            clubRole: m.club_role,
            assignedAt: m.assigned_at,
            firstName: m.profiles?.first_name || '',
            lastName: m.profiles?.last_name || '',
            email: m.profiles?.email || '',
            globalRole: m.profiles?.role || ROLE.STUDENT,
            globalRoleLabel: roleToDisplayLabel(m.profiles?.role),
        }));

        res.json({ members });
    } catch (err) {
        console.error('superadmin listClubMembers:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

const CLUB_ROLE_TO_GLOBAL = {
    president: ROLE.CLUB_PRESIDENT,
    vice_president: ROLE.CLUB_VICE_PRESIDENT,
    member: ROLE.CLUB_MEMBER,
};

// POST /api/superadmin/clubs/:id/members
const addClubMember = async (req, res) => {
    try {
        const { id: clubId } = req.params;
        const { userId, clubRole } = req.body;

        if (!userId || !clubRole) {
            return res.status(400).json({ message: 'userId and clubRole are required.' });
        }
        const validClubRoles = ['president', 'vice_president', 'member'];
        if (!validClubRoles.includes(clubRole)) {
            return res.status(400).json({ message: 'Invalid clubRole.' });
        }

        const admin = getAdminClient();

        const { data: user, error: uErr } = await admin
            .from('profiles')
            .select('id, first_name, last_name')
            .eq('id', userId)
            .maybeSingle();

        if (uErr || !user) return res.status(404).json({ message: 'User not found.' });

        const { data, error } = await admin
            .from('club_memberships')
            .upsert(
                { club_id: clubId, user_id: userId, club_role: clubRole, assigned_by: req.user.id },
                { onConflict: 'club_id,user_id' }
            )
            .select()
            .single();

        if (error) return res.status(500).json({ message: 'Could not assign member.' });

        // Sync global role
        const globalRole = CLUB_ROLE_TO_GLOBAL[clubRole];
        if (globalRole) {
            await admin.from('profiles').update({ role: globalRole }).eq('id', userId);
        }

        res.status(201).json({
            membership: data,
            message: `${user.first_name || 'User'} added as ${clubRole}.`,
        });
    } catch (err) {
        console.error('superadmin addClubMember:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// PUT /api/superadmin/clubs/:id/members/:userId
const updateClubMember = async (req, res) => {
    try {
        const { id: clubId, userId } = req.params;
        const { clubRole } = req.body;

        const validClubRoles = ['president', 'vice_president', 'member'];
        if (!validClubRoles.includes(clubRole)) {
            return res.status(400).json({ message: 'Invalid clubRole.' });
        }

        const admin = getAdminClient();
        const { data, error } = await admin
            .from('club_memberships')
            .update({ club_role: clubRole })
            .eq('club_id', clubId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) return res.status(500).json({ message: 'Could not update membership.' });
        if (!data) return res.status(404).json({ message: 'Membership not found.' });

        // Sync global role
        const globalRole = CLUB_ROLE_TO_GLOBAL[clubRole];
        if (globalRole) {
            await admin.from('profiles').update({ role: globalRole }).eq('id', userId);
        }

        res.json({ membership: data });
    } catch (err) {
        console.error('superadmin updateClubMember:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// DELETE /api/superadmin/clubs/:id/members/:userId
const removeClubMember = async (req, res) => {
    try {
        const { id: clubId, userId } = req.params;
        const admin = getAdminClient();
        const { error } = await admin
            .from('club_memberships')
            .delete()
            .eq('club_id', clubId)
            .eq('user_id', userId);

        if (error) return res.status(500).json({ message: 'Could not remove member.' });

        // Revert global role to Student
        await admin.from('profiles').update({ role: ROLE.STUDENT }).eq('id', userId);

        res.json({ message: 'Member removed.' });
    } catch (err) {
        console.error('superadmin removeClubMember:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// GET /api/superadmin/users/lookup?q=email
const lookupUser = async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q) return res.status(400).json({ message: 'Query is required.' });

        const admin = getAdminClient();
        const { data, error } = await admin
            .from('profiles')
            .select('id, first_name, last_name, email, role')
            .ilike('email', `%${q}%`)
            .limit(10);

        if (error) return res.status(500).json({ message: 'Lookup failed.' });

        res.json({
            users: (data || []).map((u) => ({
                id: u.id,
                firstName: u.first_name || '',
                lastName: u.last_name || '',
                email: u.email || '',
                role: u.role || ROLE.STUDENT,
                roleLabel: roleToDisplayLabel(u.role),
            })),
        });
    } catch (err) {
        console.error('superadmin lookupUser:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

module.exports = {
    listUsers,
    changeUserRole,
    listClubs,
    createClub,
    updateClub,
    deleteClub,
    listClubMembers,
    addClubMember,
    updateClubMember,
    removeClubMember,
    lookupUser,
};
