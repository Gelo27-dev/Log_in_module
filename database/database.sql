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

CREATE TABLE IF NOT EXISTS routes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    route_number VARCHAR(20) UNIQUE NOT NULL,
    route_name VARCHAR(100) NOT NULL,
    route_color VARCHAR(20) NOT NULL,
    start_location VARCHAR(100) NOT NULL,
    end_location VARCHAR(100) NOT NULL,
    start_lat DECIMAL(10, 8) NOT NULL,
    start_lng DECIMAL(11, 8) NOT NULL,
    end_lat DECIMAL(10, 8) NOT NULL,
    end_lng DECIMAL(11, 8) NOT NULL,
    status VARCHAR(20) DEFAULT 'ON_TIME',
    eta_minutes INT DEFAULT 0,
    frequency_minutes INT DEFAULT 10,
    current_capacity INT DEFAULT 0,
    max_capacity INT DEFAULT 40,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bus_stops (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stop_name VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    stop_type VARCHAR(50) NOT NULL COMMENT 'Active stop, Transfer hub, etc.',
    distance_km DECIMAL(5, 2) NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS travel_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    route_id INT NOT NULL,
    from_stop VARCHAR(100) NOT NULL,
    to_stop VARCHAR(100) NOT NULL,
    travel_date DATE NOT NULL,
    travel_time TIME NOT NULL,
    duration_minutes INT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    route_id INT NULL,
    feedback_text TEXT NOT NULL,
    rating INT NULL COMMENT '1-5 star rating',
    feedback_category VARCHAR(50) NULL COMMENT 'Service, Timing, Cleanliness, etc.',
    is_anonymous TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS route_stops (
    id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT NOT NULL,
    stop_id INT NOT NULL,
    stop_order INT NOT NULL,
    arrival_time_offset_minutes INT DEFAULT 0,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (stop_id) REFERENCES bus_stops(id) ON DELETE CASCADE,
    UNIQUE KEY unique_route_stop (route_id, stop_id)
);