const ROLE = {
    STUDENT: 'Student',
    ORGANIZER: 'Organizer',
    CLUB_MEMBER: 'Club Member',
    CLUB_VICE_PRESIDENT: 'Club Vice President',
    CLUB_PRESIDENT: 'Club President',
};

const ROLE_LABELS = {
    [ROLE.STUDENT]: 'Student',
    [ROLE.ORGANIZER]: 'Organizer',
    [ROLE.CLUB_MEMBER]: 'Club Member',
    [ROLE.CLUB_VICE_PRESIDENT]: 'Club Vice President',
    [ROLE.CLUB_PRESIDENT]: 'Club President',
};

const DEFAULT_ACCOUNT_ROLES = {
    student: ROLE.STUDENT,
    organizer: ROLE.ORGANIZER,
};

const CLUB_PROMOTER_ROLES = [ROLE.CLUB_PRESIDENT, ROLE.CLUB_VICE_PRESIDENT];

module.exports = {
    ROLE,
    ROLE_LABELS,
    DEFAULT_ACCOUNT_ROLES,
    CLUB_PROMOTER_ROLES,
};
