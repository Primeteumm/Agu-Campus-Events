/** Role slugs stored in DB (user_roles.role) */
const ROLE = {
    STUDENT: 'student',
    TEACHER: 'teacher',
    CLUB_MEMBER: 'club_member',
    CLUB_VICE_PRESIDENT: 'club_vice_president',
    CLUB_PRESIDENT: 'club_president',
};

/** Human-readable labels for UI */
const ROLE_LABELS = {
    [ROLE.STUDENT]: 'Student',
    [ROLE.TEACHER]: 'Teacher',
    [ROLE.CLUB_MEMBER]: 'Club Member',
    [ROLE.CLUB_VICE_PRESIDENT]: 'Club Vice President',
    [ROLE.CLUB_PRESIDENT]: 'Club President',
};

const DEFAULT_ACCOUNT_ROLES = {
    student: ROLE.STUDENT,
    teacher: ROLE.TEACHER,
};

/** President or VP may assign Club Member */
const CLUB_PROMOTER_ROLES = [ROLE.CLUB_PRESIDENT, ROLE.CLUB_VICE_PRESIDENT];

module.exports = {
    ROLE,
    ROLE_LABELS,
    DEFAULT_ACCOUNT_ROLES,
    CLUB_PROMOTER_ROLES,
};
