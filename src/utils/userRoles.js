const { ROLE, ROLE_LABELS, CLUB_PROMOTER_ROLES } = require('../constants/roles');

async function getRoleRowsForUser(userId, client) {
    if (!client) {
        return [];
    }
    const { data, error } = await client.from('profiles').select('roles').eq('id', userId).maybeSingle();
    if (error || !data) {
        return [];
    }
    const roles = data.roles;
    return Array.isArray(roles) ? roles : [];
}

async function userHasAnyRole(userId, roleSlugs, client) {
    if (!roleSlugs.length || !client) return false;
    const roles = await getRoleRowsForUser(userId, client);
    return roleSlugs.some((r) => roles.includes(r));
}

async function canAssignClubMember(userId, client) {
    return userHasAnyRole(userId, CLUB_PROMOTER_ROLES, client);
}

async function addRole(userId, roleSlug, client) {
    if (!client) throw new Error('Supabase client required');
    const roles = await getRoleRowsForUser(userId, client);
    if (roles.includes(roleSlug)) return;
    const next = [...roles, roleSlug];
    const { error } = await client.from('profiles').update({ roles: next }).eq('id', userId);
    if (error) throw error;
}

async function ensureDefaultRoleOnLogin(userId, client) {
    if (!client) return;
    const roles = await getRoleRowsForUser(userId, client);
    if (roles.length > 0) return;
    const { error } = await client
        .from('profiles')
        .update({ roles: [ROLE.STUDENT] })
        .eq('id', userId);
    if (error) {
        console.error('ensureDefaultRoleOnLogin:', error.message);
    }
}

function rolesToDisplayLabels(roleSlugs) {
    return roleSlugs.map((slug) => ROLE_LABELS[slug] || slug);
}

module.exports = {
    getRoleRowsForUser,
    userHasAnyRole,
    canAssignClubMember,
    addRole,
    ensureDefaultRoleOnLogin,
    rolesToDisplayLabels,
};
