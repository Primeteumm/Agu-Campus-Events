const { ROLE, ROLE_LABELS, CLUB_PROMOTER_ROLES } = require('../constants/roles');

async function ensureProfileRow(client, user, firstName, lastName, roleValue) {
    if (!client || !user?.id) return { ok: false, error: new Error('missing client or user') };

    const { data: existing, error: selErr } = await client
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

    if (selErr) {
        console.error('ensureProfileRow select:', selErr.message);
        return { ok: false, error: selErr };
    }
    if (existing) return { ok: true, created: false };

    const fn = firstName ?? user.user_metadata?.first_name ?? '';
    const ln = lastName ?? user.user_metadata?.last_name ?? '';
    const role = roleValue || ROLE.STUDENT;

    const { error: insErr } = await client.from('profiles').insert({
        id: user.id,
        email: user.email || null,
        first_name: String(fn).trim(),
        last_name: String(ln || '').trim(),
        role,
    });

    if (insErr) {
        console.error('ensureProfileRow insert:', insErr.message);
        return { ok: false, error: insErr };
    }
    return { ok: true, created: true };
}

async function getRoleForUser(userId, client) {
    if (!client) return null;
    const { data, error } = await client.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (error || !data) return null;
    return data.role || null;
}

async function userHasAnyRole(userId, roleSlugs, client) {
    if (!roleSlugs.length || !client) return false;
    const role = await getRoleForUser(userId, client);
    return role ? roleSlugs.includes(role) : false;
}

async function canAssignClubMember(userId, client) {
    return userHasAnyRole(userId, CLUB_PROMOTER_ROLES, client);
}

async function addRole(userId, roleSlug, client) {
    if (!client) throw new Error('Supabase client required');
    const { error } = await client.from('profiles').update({ role: roleSlug }).eq('id', userId);
    if (error) throw error;
}

async function ensureDefaultRoleOnLogin(userId, user, client) {
    if (!client) return;
    const role = await getRoleForUser(userId, client);
    if (role) return;

    const metaType = (user?.user_metadata?.account_type || 'student').toLowerCase();
    const initialRole = metaType === 'teacher' ? ROLE.TEACHER : ROLE.STUDENT;
    const authUser =
        user && user.id === userId
            ? user
            : { id: userId, email: user?.email ?? null, user_metadata: user?.user_metadata ?? {} };

    await ensureProfileRow(client, authUser, authUser.user_metadata?.first_name ?? '', authUser.user_metadata?.last_name ?? '', initialRole);

    const roleAfter = await getRoleForUser(userId, client);
    if (roleAfter) return;

    const { error } = await client.from('profiles').update({ role: initialRole }).eq('id', userId);
    if (error) console.error('ensureDefaultRoleOnLogin:', error.message);
}

function roleToDisplayLabel(role) {
    if (!role) return 'Student';
    return ROLE_LABELS[role] || role.charAt(0).toUpperCase() + role.slice(1);
}

function rolesToDisplayLabels(roles) {
    if (typeof roles === 'string') return [roleToDisplayLabel(roles)];
    if (Array.isArray(roles)) return roles.map((r) => roleToDisplayLabel(r));
    return ['Student'];
}

module.exports = {
    ensureProfileRow,
    getRoleForUser,
    userHasAnyRole,
    canAssignClubMember,
    addRole,
    ensureDefaultRoleOnLogin,
    roleToDisplayLabel,
    rolesToDisplayLabels,
};
