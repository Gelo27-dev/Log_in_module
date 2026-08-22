CREATE DATABASE IF NOT EXISTS nextstop_db;
USE nextstop_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    location VARCHAR(100) NULL,
    birthday DATE NULL,
    phone_number VARCHAR(30) NULL,
    password_hash VARCHAR(255) NULL,
    failed_attempts INT DEFAULT 0,
    account_locked TINYINT(1) DEFAULT 0,
    lock_until DATETIME NULL,
    reset_token VARCHAR(255) NULL,
    reset_token_expiry DATETIME NULL,
    google_id VARCHAR(255) NULL UNIQUE,
    facebook_id VARCHAR(255) NULL UNIQUE,
    oauth_provider VARCHAR(50) NULL,
    profile_picture VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);