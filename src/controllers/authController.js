const { supabase, createSupabaseForToken, getSupabaseAdmin } = require('../supabase');
const { DEFAULT_ACCOUNT_ROLES } = require('../constants/roles');
const {
    getRoleForUser,
    ensureDefaultRoleOnLogin,
    ensureProfileRow,
    roleToDisplayLabel,
} = require('../utils/userRoles');

function buildClientUser(authUser, profile, role) {
    const firstName =
        profile?.first_name ?? authUser.user_metadata?.first_name ?? '';
    const lastName = profile?.last_name ?? authUser.user_metadata?.last_name ?? '';
    const name = `${firstName} ${lastName}`.trim() || authUser.email || 'User';
    const r = role || profile?.role || 'Student';
    return {
        id: authUser.id,
        username: profile?.username ?? null,
        firstName,
        lastName,
        name,
        email: authUser.email || profile?.email,
        role: r,
        roles: [r],
        roleLabels: [roleToDisplayLabel(r)],
    };
}

/**
 * POST /api/auth/register
 * Profile row is created automatically by the SQL trigger on auth.users INSERT.
 */
const register = async (req, res) => {
    try {
        const { email, password, accountType } = req.body;

        const first_name = (req.body.first_name || req.body.firstName || '').trim();
        const last_name = (req.body.last_name || req.body.lastName || '').trim();

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }
        if (!first_name) {
            return res.status(400).json({ message: 'First name is required.' });
        }

        const type = (accountType || 'student').toLowerCase();
        const defaultRole =
            type === 'organizer' ? DEFAULT_ACCOUNT_ROLES.organizer : DEFAULT_ACCOUNT_ROLES.student;

        const { data, error } = await supabase.auth.signUp({
            email: String(email).trim(),
            password,
            options: {
                data: {
                    first_name,
                    last_name,
                    account_type: type,
                },
            },
        });

        if (error) {
            const msg = (error.message || '').toLowerCase();
            if (
                msg.includes('already registered') ||
                msg.includes('already been registered') ||
                msg.includes('duplicate') ||
                msg.includes('already exists')
            ) {
                return res.status(400).json({ message: 'An account with this email already exists.' });
            }
            return res.status(400).json({ message: error.message || 'Registration failed.' });
        }

        let user = data.user;
        let session = data.session;

        if (!user) {
            return res.status(400).json({ message: 'Registration failed.' });
        }

        if (!user.identities || user.identities.length === 0) {
            return res.status(400).json({ message: 'An account with this email already exists.' });
        }

        if (!session?.access_token) {
            const loginResp = await supabase.auth.signInWithPassword({
                email: String(email).trim(),
                password,
            });
            if (loginResp.data?.session) {
                session = loginResp.data.session;
                user = loginResp.data.user;
            }
        }

        if (!session?.access_token) {
            return res.status(201).json({
                success: true,
                message: 'Registration successful. If required, please verify your email.',
                user: buildClientUser(user, null, defaultRole),
            });
        }

        const sb = createSupabaseForToken(session.access_token);
        const adminClient = getSupabaseAdmin();
        const reader = adminClient || sb;
        const { data: profile } = await reader
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        let finalRole = profile?.role || defaultRole;

        if (profile && profile.role !== defaultRole) {
            const client = adminClient || sb;
            const { error: roleErr } = await client
                .from('profiles')
                .update({ role: defaultRole })
                .eq('id', user.id);
            if (!roleErr) finalRole = defaultRole;
        }

        return res.status(201).json({
            success: true,
            message: 'User registered successfully.',
            access_token: session.access_token,
            token: session.access_token,
            refreshToken: session.refresh_token,
            user: buildClientUser(user, profile, finalRole),
        });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: String(email).trim(),
            password,
        });

        if (error) {
            return res.status(401).json({
                success: false,
                message: error.message === 'Invalid login credentials'
                    ? 'Invalid email or password.'
                    : error.message || 'Login failed.',
            });
        }

        if (!data.session || !data.user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const { user, session } = data;
        const sb = createSupabaseForToken(session.access_token);
        const admin = getSupabaseAdmin();
        const reader = admin || sb;

        await ensureDefaultRoleOnLogin(user.id, user, reader);

        const { data: profile } = await reader.from('profiles').select('*').eq('id', user.id).maybeSingle();
        let role = profile?.role || null;

        if (!role) {
            await ensureProfileRow(reader, user, '', '', 'Student');
            role = await getRoleForUser(user.id, reader);
            if (!role) role = 'Student';
        }

        return res.json({
            success: true,
            message: 'Login successful.',
            access_token: session.access_token,
            token: session.access_token,
            refreshToken: session.refresh_token,
            user: buildClientUser(user, profile, role),
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

module.exports = { register, login };
