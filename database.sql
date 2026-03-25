-- =============================================
-- Campus Event Organizer - Database Setup
-- =============================================

-- 1. Create the database
CREATE DATABASE IF NOT EXISTS agucampusevents;
USE agucampusevents;

-- 2. Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Events table
CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    date DATETIME NOT NULL,
    location VARCHAR(200) NOT NULL,
    capacity INT NOT NULL DEFAULT 50,
    organizer_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key: organizer must be a valid user
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Event Participants table
CREATE TABLE IF NOT EXISTS event_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    event_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,

    -- Prevent duplicate joins: a user can join an event only once
    UNIQUE KEY unique_participation (user_id, event_id)
);
