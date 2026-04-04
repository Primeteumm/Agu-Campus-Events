const { getSupabaseAdmin } = require('../supabase');
const { ROLE } = require('../constants/roles');
const { getRoleForUser, roleToDisplayLabel } = require('../utils/userRoles');

const ADMIN_ROLES = [ROLE.TEACHER, ROLE.CLUB_PRESIDENT];

function getAdminClient() {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
    return admin;
}

// GET /api/admin/users
const listUsers = async (req, res) => {
    try {
        const admin = getAdminClient();
        const myRole = await getRoleForUser(req.user.id, admin);

        if (!myRole || !ADMIN_ROLES.includes(myRole)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const { data: profiles, error } = await admin
            .from('profiles')
            .select('id, first_name, last_name, email, role')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('admin listUsers:', error.message);
            return res.status(500).json({ message: 'Could not fetch users.' });
        }

        let users = profiles || [];

        if (myRole === ROLE.CLUB_PRESIDENT) {
            users = users.filter((u) => u.role !== ROLE.TEACHER);
        }

        res.json({
            myRole,
            users: users.map((u) => ({
                id: u.id,
                firstName: u.first_name || '',
                lastName: u.last_name || '',
                email: u.email || '',
                role: u.role || ROLE.STUDENT,
                roleLabel: roleToDisplayLabel(u.role),
            })),
        });
    } catch (err) {
        console.error('admin listUsers error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// PUT /api/admin/role
const changeRole = async (req, res) => {
    try {
        const { targetUserId, newRole } = req.body;

        if (!targetUserId || !newRole) {
            return res.status(400).json({ message: 'targetUserId and newRole are required.' });
        }

        if (targetUserId === req.user.id) {
            return res.status(400).json({ message: 'You cannot change your own role.' });
        }

        const validRoles = [ROLE.STUDENT, ROLE.TEACHER, ROLE.CLUB_PRESIDENT, ROLE.CLUB_VICE_PRESIDENT, ROLE.CLUB_MEMBER];
        if (!validRoles.includes(newRole)) {
            return res.status(400).json({ message: 'Invalid role.' });
        }

        const admin = getAdminClient();
        const myRole = await getRoleForUser(req.user.id, admin);

        if (!myRole || !ADMIN_ROLES.includes(myRole)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const { data: target, error: tErr } = await admin
            .from('profiles')
            .select('id, role, first_name, last_name')
            .eq('id', targetUserId)
            .maybeSingle();

        if (tErr || !target) {
            return res.status(404).json({ message: 'Target user not found.' });
        }

        const targetRole = target.role || ROLE.STUDENT;

        // ── Teacher rules ──
        if (myRole === ROLE.TEACHER) {
            if (targetRole === ROLE.TEACHER) {
                return res.status(403).json({ message: 'You cannot change another Teacher\'s role.' });
            }
            if (![ROLE.CLUB_PRESIDENT, ROLE.STUDENT].includes(newRole)) {
                return res.status(403).json({ message: 'Teachers can only set roles to Club President or Student.' });
            }
        }

        // ── Club President rules ──
        if (myRole === ROLE.CLUB_PRESIDENT) {
            if (targetRole === ROLE.TEACHER) {
                return res.status(403).json({ message: 'You cannot change a Teacher\'s role.' });
            }
            if (targetRole === ROLE.CLUB_PRESIDENT) {
                return res.status(403).json({ message: 'You cannot change another Club President\'s role.' });
            }

            const allowed =
                ((targetRole === ROLE.STUDENT || targetRole === ROLE.CLUB_MEMBER) && newRole === ROLE.CLUB_VICE_PRESIDENT) ||
                (targetRole === ROLE.CLUB_VICE_PRESIDENT && newRole === ROLE.STUDENT) ||
                (targetRole === ROLE.CLUB_MEMBER && newRole === ROLE.STUDENT);

            if (!allowed) {
                return res.status(403).json({
                    message: 'Club Presidents can only promote Students/Members to Vice President or demote Vice Presidents/Members to Student.',
                });
            }
        }

        const { error: upErr } = await admin
            .from('profiles')
            .update({ role: newRole })
            .eq('id', targetUserId);

        if (upErr) {
            console.error('admin changeRole update:', upErr.message);
            return res.status(500).json({ message: 'Could not update role.' });
        }

        const name = `${target.first_name || ''} ${target.last_name || ''}`.trim() || 'User';
        res.json({
            message: `${name} is now ${roleToDisplayLabel(newRole)}.`,
            userId: targetUserId,
            newRole,
            newRoleLabel: roleToDisplayLabel(newRole),
        });
    } catch (err) {
        console.error('admin changeRole error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

module.exports = { listUsers, changeRole };
