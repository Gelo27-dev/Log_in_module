-- ============================================
-- AUDIT DATABASE TABLES
-- ============================================
-- These tables track all user activities, system changes, and data modifications
-- for compliance, security, and troubleshooting purposes

-- ============================================
-- 1. GENERAL AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    username VARCHAR(50) NULL,
    action VARCHAR(100) NOT NULL COMMENT 'User action performed',
    entity_type VARCHAR(50) NOT NULL COMMENT 'What was affected (user, route, feedback, etc.)',
    entity_id INT NULL COMMENT 'ID of affected entity',
    old_value JSON NULL COMMENT 'Previous value (for updates)',
    new_value JSON NULL COMMENT 'New value (for updates/creates)',
    ip_address VARCHAR(45) NULL COMMENT 'IPv4 or IPv6',
    user_agent TEXT NULL COMMENT 'Browser info',
    status VARCHAR(20) COMMENT 'success, failed, error',
    error_message TEXT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id)
);

-- ============================================
-- 2. LOGIN AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS login_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    username VARCHAR(50) NULL,
    email VARCHAR(100) NULL,
    login_method VARCHAR(50) NOT NULL COMMENT 'email_password, google, facebook',
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    login_status VARCHAR(20) NOT NULL COMMENT 'success, failed, locked',
    failure_reason VARCHAR(255) NULL COMMENT 'Invalid credentials, account locked, etc.',
    session_id VARCHAR(255) NULL,
    login_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_timestamp TIMESTAMP NULL,
    session_duration_minutes INT NULL COMMENT 'Minutes until logout or timeout',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_login_timestamp (login_timestamp),
    INDEX idx_email (email)
);

-- ============================================
-- 3. ROUTE DATA CHANGES
-- ============================================
CREATE TABLE IF NOT EXISTS route_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT NOT NULL,
    changed_by INT NULL,
    changed_by_username VARCHAR(50) NULL,
    change_type VARCHAR(20) NOT NULL COMMENT 'CREATE, UPDATE, DELETE',
    field_name VARCHAR(100) NOT NULL COMMENT 'Which field changed',
    old_value VARCHAR(255) NULL,
    new_value VARCHAR(255) NULL,
    change_reason TEXT NULL COMMENT 'Why was this changed',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_route_id (route_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_change_type (change_type)
);

-- ============================================
-- 4. BUS STOP DATA CHANGES
-- ============================================
CREATE TABLE IF NOT EXISTS stop_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stop_id INT NOT NULL,
    changed_by INT NULL,
    changed_by_username VARCHAR(50) NULL,
    change_type VARCHAR(20) NOT NULL COMMENT 'CREATE, UPDATE, DELETE',
    field_name VARCHAR(100) NOT NULL,
    old_value VARCHAR(255) NULL,
    new_value VARCHAR(255) NULL,
    change_reason TEXT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stop_id) REFERENCES bus_stops(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_stop_id (stop_id),
    INDEX idx_timestamp (timestamp)
);

-- ============================================
-- 5. FEEDBACK AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS feedback_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    feedback_id INT NOT NULL,
    user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL COMMENT 'submitted, edited, deleted, flagged',
    feedback_text TEXT NULL COMMENT 'Content of feedback',
    rating INT NULL,
    category VARCHAR(50) NULL,
    admin_notes TEXT NULL COMMENT 'Admin review/action notes',
    status VARCHAR(50) COMMENT 'pending, reviewed, resolved, archived',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_timestamp (timestamp)
);

-- ============================================
-- 6. TRIP AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS trip_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trip_id INT NOT NULL,
    user_id INT NOT NULL,
    route_id INT NOT NULL,
    logged_by INT NULL COMMENT 'User or admin who logged the trip',
    logged_by_username VARCHAR(50) NULL,
    action VARCHAR(50) NOT NULL COMMENT 'logged, edited, verified, deleted',
    from_stop VARCHAR(100) NULL,
    to_stop VARCHAR(100) NULL,
    travel_date DATE NULL,
    travel_time TIME NULL,
    verification_status VARCHAR(50) COMMENT 'auto-logged, manually-logged, verified, rejected',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES travel_history(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (logged_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_trip_id (trip_id),
    INDEX idx_timestamp (timestamp)
);

-- 🔐 ============================================
-- 7️⃣  USER ACCOUNT CHANGES
-- 🔐 ============================================
CREATE TABLE IF NOT EXISTS account_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    changed_by INT NULL COMMENT 'User self or admin',
    changed_by_username VARCHAR(50) NULL,
    change_type VARCHAR(50) NOT NULL COMMENT 'password_change, email_update, profile_update, account_locked, account_unlocked',
    field_name VARCHAR(100) NOT NULL,
    old_value VARCHAR(255) NULL,
    new_value VARCHAR(255) NULL COMMENT 'Hidden for passwords',
    ip_address VARCHAR(45) NULL,
    reason TEXT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_change_type (change_type),
    INDEX idx_timestamp (timestamp)
);

-- 🗑 ============================================
-- 8️⃣  SESSION AUDIT LOG
-- 🗑 ============================================
CREATE TABLE IF NOT EXISTS session_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_id VARCHAR(255) NULL UNIQUE,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP NULL,
    last_activity TIMESTAMP NULL,
    termination_reason VARCHAR(100) COMMENT 'manual_logout, timeout, session_expired, concurrent_login',
    activity_count INT DEFAULT 1 COMMENT 'Number of API calls in session',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_session_start (session_start)
);

-- 🔌 ============================================
-- 9️⃣  API ACCESS LOG
-- 🔌 ============================================
CREATE TABLE IF NOT EXISTS api_access_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    endpoint VARCHAR(255) NOT NULL COMMENT 'e.g., /api/routes, /api/feedback',
    method VARCHAR(10) NOT NULL COMMENT 'GET, POST, PUT, DELETE',
    ip_address VARCHAR(45) NULL,
    request_body JSON NULL COMMENT 'Parameters sent',
    response_status INT NOT NULL COMMENT '200, 400, 500, etc.',
    response_time_ms INT COMMENT 'Query execution time',
    error_message TEXT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_endpoint (endpoint),
    INDEX idx_timestamp (timestamp),
    INDEX idx_user_id (user_id),
    INDEX idx_response_status (response_status)
);

-- 📦 ============================================
-- 1🔟  SYSTEM EVENTS LOG
-- 📦 ============================================
CREATE TABLE IF NOT EXISTS system_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL COMMENT 'server_start, server_stop, database_error, email_sent, etc.',
    severity VARCHAR(20) COMMENT 'info, warning, error, critical',
    message TEXT NOT NULL,
    details JSON NULL,
    related_user_id INT NULL,
    related_entity_type VARCHAR(50) NULL,
    related_entity_id INT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_event_type (event_type),
    INDEX idx_severity (severity),
    INDEX idx_timestamp (timestamp)
);

-- ============================================
-- 11. DATA INTEGRITY CHECKS
-- ============================================
CREATE TABLE IF NOT EXISTS data_integrity_checks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    check_type VARCHAR(100) NOT NULL COMMENT 'duplicate_routes, missing_stops, orphaned_history, etc.',
    check_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) COMMENT 'passed, warning, failed',
    records_affected INT,
    details JSON NULL,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    resolved_by INT NULL,
    resolution_details TEXT NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_check_type (check_type),
    INDEX idx_status (status)
);

-- ============================================
-- 12. PERFORMANCE METRICS
-- ============================================
CREATE TABLE IF NOT EXISTS performance_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL COMMENT 'routes_load_time, feedback_submit_time, etc.',
    endpoint VARCHAR(255) NULL,
    average_response_time_ms DECIMAL(10, 2),
    min_response_time_ms INT,
    max_response_time_ms INT,
    request_count INT,
    error_count INT,
    recorded_date DATE,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metric_name (metric_name),
    INDEX idx_recorded_date (recorded_date)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
-- Note: Most indexes already created above
-- Additional compound indexes for common queries:

ALTER TABLE audit_logs ADD INDEX idx_user_action_timestamp (user_id, action, timestamp);
ALTER TABLE login_audit ADD INDEX idx_user_status_timestamp (user_id, login_status, login_timestamp);
ALTER TABLE route_audit ADD INDEX idx_route_timestamp (route_id, timestamp);
ALTER TABLE feedback_audit ADD INDEX idx_user_status_timestamp (user_id, status, timestamp);

-- ============================================
-- END OF AUDIT DATABASE SCHEMA
-- ============================================
