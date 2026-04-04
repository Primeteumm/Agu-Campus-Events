const ROLE = {
    STUDENT: 'Student',
    TEACHER: 'Teacher',
    CLUB_MEMBER: 'Club Member',
    CLUB_VICE_PRESIDENT: 'Club Vice President',
    CLUB_PRESIDENT: 'Club President',
};

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

const CLUB_PROMOTER_ROLES = [ROLE.CLUB_PRESIDENT, ROLE.CLUB_VICE_PRESIDENT];

module.exports = {
    ROLE,
    ROLE_LABELS,
    DEFAULT_ACCOUNT_ROLES,
    CLUB_PROMOTER_ROLES,
};
