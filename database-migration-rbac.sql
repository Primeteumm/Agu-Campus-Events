-- =============================================
-- Upgrade existing DB (old users.name + users.role) to RBAC schema
-- Run once against your existing agucampusevents database.
-- =============================================

USE agucampusevents;

-- Add new columns if your table still has the legacy shape
ALTER TABLE users
    ADD COLUMN username VARCHAR(80) NULL AFTER id,
    ADD COLUMN first_name VARCHAR(100) NULL AFTER username,
    ADD COLUMN last_name VARCHAR(100) NULL DEFAULT '' AFTER first_name,
    ADD COLUMN avatar_url VARCHAR(500) NULL AFTER password;

-- Backfill names from legacy `name` if present
UPDATE users
SET
    first_name = CASE
        WHEN first_name IS NOT NULL AND first_name != '' THEN first_name
        WHEN name IS NOT NULL AND LOCATE(' ', TRIM(name)) > 0 THEN SUBSTRING_INDEX(TRIM(name), ' ', 1)
        WHEN name IS NOT NULL THEN TRIM(name)
        ELSE 'User'
    END,
    last_name = CASE
        WHEN last_name IS NOT NULL AND last_name != '' THEN last_name
        WHEN name IS NOT NULL AND LOCATE(' ', TRIM(name)) > 0 THEN TRIM(SUBSTRING(name, LOCATE(' ', TRIM(name)) + 1))
        ELSE ''
    END
WHERE first_name IS NULL OR first_name = '';

UPDATE users
SET username = CONCAT('user_', id)
WHERE username IS NULL OR username = '';

ALTER TABLE users MODIFY username VARCHAR(80) NOT NULL;
ALTER TABLE users MODIFY first_name VARCHAR(100) NOT NULL;

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT NOT NULL,
    role ENUM(
        'student',
        'teacher',
        'club_member',
        'club_vice_president',
        'club_president'
    ) NOT NULL,
    PRIMARY KEY (user_id, role),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Map old single role to new roles
INSERT IGNORE INTO user_roles (user_id, role)
SELECT id, 'teacher' FROM users WHERE role = 'admin';

INSERT IGNORE INTO user_roles (user_id, role)
SELECT id, 'student' FROM users WHERE role = 'user' OR role IS NULL;

INSERT IGNORE INTO user_roles (user_id, role)
SELECT u.id, 'student'
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL;

-- Drop legacy column after data moved (uncomment when verified)
-- ALTER TABLE users DROP COLUMN name;
-- ALTER TABLE users DROP COLUMN role;
