const { supabase, createSupabaseForToken } = require('../supabase');
const { ROLE } = require('../constants/roles');
const {
    getRoleForUser,
    addRole,
    roleToDisplayLabel,
    canAssignClubMember,
} = require('../utils/userRoles');

function buildAvatarUrl(firstName, lastName) {
    const name = encodeURIComponent(`${firstName || 'User'} ${lastName || ''}`.trim());
    return `https://ui-avatars.com/api/?name=${name}&background=1565c0&color=fff&size=128`;
}

async function fetchProfile(client, id) {
    const { data, error } = await client.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error) {
        console.error('fetchProfile:', error.message);
        return null;
    }
    return data;
}

function mapProfileToUser(profile, role, canPromote) {
    const r = role || profile.role || 'student';
    return {
        id: profile.id,
        username: profile.username,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email,
        avatarUrl: profile.avatar_url || buildAvatarUrl(profile.first_name, profile.last_name),
        createdAt: profile.created_at,
        role: r,
        roles: [r],
        roleLabels: [roleToDisplayLabel(r)],
        canAssignClubMember: canPromote,
    };
}

// GET /api/users/me
const getMe = async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const sb = createSupabaseForToken(req.accessToken);
        const profile = await fetchProfile(sb, req.user.id);

        if (!profile) {
            return res.status(404).json({ message: 'User not found' });
        }

        const role = await getRoleForUser(req.user.id, sb);
        const canPromote = await canAssignClubMember(req.user.id, sb);

        res.json({
            user: mapProfileToUser(profile, role || 'student', canPromote),
        });
    } catch (error) {
        console.error('getMe error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// PATCH /api/users/me
const updateMe = async (req, res) => {
    try {
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'email')) {
            return res.status(400).json({ message: 'Email address cannot be changed.' });
        }

        if (!req.accessToken) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { username, first_name, last_name, password, currentPassword } = req.body;
        const sb = createSupabaseForToken(req.accessToken);

        const profile = await fetchProfile(sb, req.user.id);
        if (!profile) {
            return res.status(404).json({ message: 'User not found' });
        }

        const nameUpdates = {};
        if (first_name !== undefined) nameUpdates.first_name = String(first_name).trim();
        if (last_name !== undefined) nameUpdates.last_name = String(last_name).trim();
        if (Object.keys(nameUpdates).length > 0) {
            const { error: nameErr } = await sb.from('profiles').update(nameUpdates).eq('id', req.user.id);
            if (nameErr) {
                return res.status(400).json({ message: nameErr.message });
            }
        }

        if (username !== undefined && username !== null) {
            const trimmed = String(username).trim();
            if (trimmed.length < 2) {
                return res.status(400).json({ message: 'Username must be at least 2 characters.' });
            }
            if (trimmed.length > 80) {
                return res.status(400).json({ message: 'Username is too long.' });
            }

            const { data: dup } = await sb.from('profiles').select('id').eq('username', trimmed).neq('id', req.user.id).maybeSingle();

            if (dup) {
                return res.status(400).json({ message: 'That username is already taken.' });
            }

            const { error: upErr } = await sb.from('profiles').update({ username: trimmed }).eq('id', req.user.id);
            if (upErr) {
                return res.status(400).json({ message: upErr.message });
            }
        }

        if (password !== undefined && password !== null && String(password).length > 0) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required to set a new password.' });
            }

            const email = profile.email || req.user.email;
            if (!email) {
                return res.status(400).json({ message: 'Cannot verify password.' });
            }

            const { error: signErr } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword,
            });

            if (signErr) {
                return res.status(401).json({ message: 'Current password is incorrect.' });
            }

            const { error: pwdErr } = await sb.auth.updateUser({ password: String(password) });
            if (pwdErr) {
                return res.status(400).json({ message: pwdErr.message });
            }
        }

        const updated = await fetchProfile(sb, req.user.id);
        const role = await getRoleForUser(req.user.id, sb);
        const canPromote = await canAssignClubMember(req.user.id, sb);

        res.json({
            message: 'Profile updated successfully.',
            user: mapProfileToUser(updated, role || 'student', canPromote),
        });
    } catch (error) {
        console.error('updateMe error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/users/:targetUserId/roles/club-member
const assignClubMemberRole = async (req, res) => {
    try {
        const targetUserId = req.params.targetUserId;
        if (!targetUserId) {
            return res.status(400).json({ message: 'Invalid user id.' });
        }
        if (targetUserId === req.user.id) {
            return res.status(400).json({ message: 'You cannot change your own role this way.' });
        }

        if (!req.accessToken) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const sb = createSupabaseForToken(req.accessToken);

        const { data: target, error: tErr } = await sb
            .from('profiles')
            .select('id, email, first_name, last_name')
            .eq('id', targetUserId)
            .maybeSingle();

        if (tErr || !target) {
            return res.status(404).json({ message: 'User not found.' });
        }

        await addRole(targetUserId, ROLE.CLUB_MEMBER, sb);
        const role = await getRoleForUser(targetUserId, sb);

        res.json({
            message: `Club Member role assigned to ${target.first_name || ''} ${target.last_name || ''}.`,
            userId: targetUserId,
            role,
            roleLabels: [roleToDisplayLabel(role)],
        });
    } catch (error) {
        console.error('assignClubMemberRole error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/users/lookup?q=email
const lookupUserByEmail = async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q || !q.includes('@')) {
            return res.status(400).json({ message: 'Provide a valid email in q= query parameter.' });
        }

        if (!req.accessToken) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const sb = createSupabaseForToken(req.accessToken);

        const { data: row, error } = await sb
            .from('profiles')
            .select('id, first_name, last_name, email, role')
            .ilike('email', q)
            .maybeSingle();

        if (error || !row) {
            return res.status(404).json({ message: 'No user with that email.' });
        }

        const r = row.role || 'student';
        res.json({
            user: {
                id: row.id,
                firstName: row.first_name,
                lastName: row.last_name,
                email: row.email,
                role: r,
                roles: [r],
                roleLabels: [roleToDisplayLabel(r)],
            },
        });
    } catch (error) {
        console.error('lookupUserByEmail error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getMe,
    updateMe,
    assignClubMemberRole,
    lookupUserByEmail,
};
