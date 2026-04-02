-- =============================================
-- Campus Event Organizer - Database Setup (RBAC)
-- =============================================

CREATE DATABASE IF NOT EXISTS agucampusevents;
USE agucampusevents;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL DEFAULT '',
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Multiple roles per user (Student, Teacher, Club Member, Club VP, Club President)
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

-- Events
CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    date DATETIME NOT NULL,
    location VARCHAR(200) NOT NULL,
    capacity INT NOT NULL DEFAULT 50,
    organizer_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Event participants
CREATE TABLE IF NOT EXISTS event_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    event_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE KEY unique_participation (user_id, event_id)
);

-- Optional: promote a user to Club President or Club Vice President (replace USER_ID)
-- INSERT INTO user_roles (user_id, role) VALUES (USER_ID, 'club_president');
-- INSERT INTO user_roles (user_id, role) VALUES (USER_ID, 'club_vice_president');
