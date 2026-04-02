const { supabase, createSupabaseForToken } = require('../supabase');
const { DEFAULT_ACCOUNT_ROLES } = require('../constants/roles');
const {
    getRoleRowsForUser,
    ensureDefaultRoleOnLogin,
    rolesToDisplayLabels,
} = require('../utils/userRoles');

function pickNames(body) {
    const fn =
        body.first_name ??
        body.firstName ??
        (typeof body.name === 'string' ? body.name.trim().split(/\s+/)[0] : null);
    const ln =
        body.last_name ??
        body.lastName ??
        (typeof body.name === 'string' && body.name.includes(' ')
            ? body.name.trim().split(/\s+/).slice(1).join(' ')
            : '');
    return {
        first_name: fn != null ? String(fn).trim() : '',
        last_name: ln != null ? String(ln).trim() : '',
    };
}

function buildClientUser(authUser, profile, roles) {
    const firstName =
        profile?.first_name ?? authUser.user_metadata?.first_name ?? '';
    const lastName = profile?.last_name ?? authUser.user_metadata?.last_name ?? '';
    const name = `${firstName} ${lastName}`.trim() || authUser.email || 'User';
    const roleList = roles?.length ? roles : ['student'];
    return {
        id: authUser.id,
        username: profile?.username ?? null,
        firstName,
        lastName,
        name,
        email: authUser.email || profile?.email,
        roles: roleList,
        roleLabels: rolesToDisplayLabels(roleList),
    };
}

/**
 * POST /api/auth/register
 * Uses Supabase Auth only (no MySQL). first_name / last_name go into raw_user_meta_data for your profiles trigger.
 */
const register = async (req, res) => {
    try {
        const { email, password, accountType } = req.body;
        const { first_name, last_name } = pickNames(req.body);

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }
        if (!first_name) {
            return res.status(400).json({ message: 'First name is required.' });
        }

        const type = (accountType || 'student').toLowerCase();
        const defaultRole =
            type === 'teacher' ? DEFAULT_ACCOUNT_ROLES.teacher : DEFAULT_ACCOUNT_ROLES.student;

        const { data, error } = await supabase.auth.signUp({
            email: String(email).trim(),
            password,
            options: {
                data: {
                    first_name,
                    last_name: last_name || '',
                    account_type: type,
                },
            },
        });

        if (error) {
            return res.status(400).json({ message: error.message || 'Registration failed.' });
        }

        const user = data.user;
        const session = data.session;

        if (!user) {
            return res.status(400).json({ message: 'Registration failed.' });
        }

        if (session?.access_token) {
            const sb = createSupabaseForToken(session.access_token);
            let roles = await getRoleRowsForUser(user.id, sb);

            if (type === 'teacher') {
                await sb.from('profiles').update({ roles: [DEFAULT_ACCOUNT_ROLES.teacher] }).eq('id', user.id);
                roles = [DEFAULT_ACCOUNT_ROLES.teacher];
            } else if (!roles.length) {
                await sb.from('profiles').update({ roles: [DEFAULT_ACCOUNT_ROLES.student] }).eq('id', user.id);
                roles = [DEFAULT_ACCOUNT_ROLES.student];
            }

            const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
            const finalRoles = (await getRoleRowsForUser(user.id, sb)) || roles;

            return res.status(201).json({
                success: true,
                message: 'User registered successfully.',
                token: session.access_token,
                user: buildClientUser(user, profile, finalRoles),
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Check your email to confirm your account, then sign in.',
            user: buildClientUser(user, null, [defaultRole]),
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

        await ensureDefaultRoleOnLogin(user.id, sb);

        let roles = await getRoleRowsForUser(user.id, sb);
        if (!roles.length) {
            await sb.from('profiles').update({ roles: ['student'] }).eq('id', user.id);
            roles = ['student'];
        }

        const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
        roles = (await getRoleRowsForUser(user.id, sb)) || roles;

        return res.json({
            success: true,
            message: 'Login successful.',
            token: session.access_token,
            user: buildClientUser(user, profile, roles),
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

module.exports = { register, login };
