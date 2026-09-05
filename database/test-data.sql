-- ============================================
-- NEXTSTOP TEST DATA - TEMPORARY EXAMPLE ROUTES
-- ============================================
-- Run this BEFORE sample-data.sql to test outputs
-- This creates MORE routes for comprehensive testing
-- 
-- MySQL Command:
-- mysql -u root nextstop_db < test-data.sql
--
-- OR in phpMyAdmin:
-- 1. Go to SQL tab
-- 2. Copy and paste this entire file
-- 3. Click "Go"
--
-- To CLEAR this test data:
-- DELETE FROM route_stops;
-- DELETE FROM routes;
-- DELETE FROM bus_stops;
-- ============================================

USE nextstop_db;

-- ============================================
-- TEST BUS STOPS (10 stops for variety)
-- ============================================

INSERT INTO bus_stops (stop_name, latitude, longitude, stop_type, distance_km, is_active) VALUES

-- Primary stops
('SM Aurora Premier', 14.5515, 121.0505, 'Active stop', 0.0, 1),
('High Street Central', 14.5573, 121.0475, 'Popular stop', 1.2, 1),
('Bonifacio Global City Gate', 14.5960, 121.0333, 'Transfer hub', 2.5, 1),
('Uptown Drive', 14.5730, 121.0520, 'Active stop', 1.5, 1),
('McKinley Hill', 14.6091, 121.0245, 'Active stop', 3.2, 1),

-- Additional test stops
('Market! Market!', 14.5425, 121.0385, 'Popular stop', 0.8, 1),
('BGC Corporate Park', 14.5645, 121.0425, 'Active stop', 1.0, 1),
('Serendra', 14.5555, 121.0555, 'Popular stop', 0.5, 1),
('Taguig City Hall', 14.5880, 121.0155, 'Government center', 2.8, 1),
('Entertainment City', 14.6145, 121.0425, 'Transit hub', 3.5, 1);

-- ============================================
-- TEST ROUTES (8 routes for testing)
-- ============================================

INSERT INTO routes (route_number, route_name, route_color, start_location, end_location, start_lat, start_lng, end_lat, end_lng, status, eta_minutes, frequency_minutes, current_capacity, max_capacity, is_active) VALUES

-- Route 1: Green - ON TIME (Very fast)
('BGC-101', 'BGC Express', '#00C853', 'SM Aurora Premier', 'McKinley Hill', 14.5515, 121.0505, 14.6091, 121.0245, 'ON_TIME', 4, 10, 6, 10, 1),

-- Route 2: Blue - ON TIME (Medium)
('BGC-204', 'Uptown Shutter', '#1976D2', 'High Street Central', 'Uptown Drive', 14.5573, 121.0475, 14.5730, 121.0520, 'ON_TIME', 7, 15, 8, 15, 1),

-- Route 3: Orange - DELAY (Slower, more capacity)
('BGC-317', 'Venice Loop', '#F59E0B', 'Bonifacio Global City Gate', 'Bonifacio', 14.5960, 121.0333, 14.5425, 121.0385, 'DELAY', 11, 12, 9, 12, 1),

-- Route 4: Purple - ON TIME (Quick)
('BGC-409', 'Bonifacio Link', '#9C27B0', 'McKinley Hill', 'SM Aurora Premier', 14.6091, 121.0245, 14.5515, 121.0505, 'ON_TIME', 3, 8, 8, 10, 1),

-- Route 5: Red - DELAY (Heavy traffic)
('BGC-510', 'Market Express', '#D32F2F', 'Market! Market!', 'Entertainment City', 14.5425, 121.0385, 14.6145, 121.0425, 'DELAY', 15, 20, 12, 15, 1),

-- Route 6: Teal - ON TIME (Moderate)
('BGC-612', 'Corporate Shuttle', '#00897B', 'BGC Corporate Park', 'Taguig City Hall', 14.5645, 121.0425, 14.5880, 121.0155, 'ON_TIME', 5, 12, 4, 20, 1),

-- Route 7: Indigo - ON TIME (Nearly full)
('BGC-725', 'Serendra Link', '#3949AB', 'Serendra', 'High Street Central', 14.5555, 121.0555, 14.5573, 121.0475, 'ON_TIME', 2, 6, 18, 20, 1),

-- Route 8: Pink - DELAY (Very slow)
('BGC-831', 'Downtown Connector', '#E91E63', 'Entertainment City', 'SM Aurora Premier', 14.6145, 121.0425, 14.5515, 121.0505, 'DELAY', 20, 25, 14, 15, 1);

-- ============================================
-- TEST ROUTE-STOP CONNECTIONS (Ordered sequences)
-- ============================================

-- BGC-101 Express: SM Aurora → High Street → McKinley (3 stops)
INSERT INTO route_stops (route_id, stop_id, stop_order, arrival_time_offset_minutes) VALUES
(1, 1, 1, 0),      -- SM Aurora (start)
(1, 2, 2, 3),      -- High Street
(1, 5, 3, 4);      -- McKinley Hill (end)

-- BGC-204 Shutter: High Street → Serendra → Uptown (3 stops)
INSERT INTO route_stops (route_id, stop_id, stop_order, arrival_time_offset_minutes) VALUES
(2, 2, 1, 0),      -- High Street (start)
(2, 8, 2, 2),      -- Serendra
(2, 4, 3, 7);      -- Uptown Drive (end)

-- BGC-317 Venice Loop: BGC Gate → Market → High Street → Back (4 stops)
INSERT INTO route_stops (route_id, stop_id, stop_order, arrival_time_offset_minutes) VALUES
(3, 3, 1, 0),      -- BGC Gate (start)
(3, 6, 2, 4),      -- Market
(3, 2, 3, 8),      -- High Street
(3, 6, 4, 11);     -- Market (loop back)

-- BGC-409 Link: McKinley → Uptown → SM Aurora (3 stops)
INSERT INTO route_stops (route_id, stop_id, stop_order, arrival_time_offset_minutes) VALUES
(4, 5, 1, 0),      -- McKinley (start)
(4, 4, 2, 1),      -- Uptown Drive
(4, 1, 3, 3);      -- SM Aurora (end)

-- BGC-510 Market: Market → Corporate → City Hall → Entertainment (4 stops)
INSERT INTO route_stops (route_id, stop_id, stop_order, arrival_time_offset_minutes) VALUES
(5, 6, 1, 0),      -- Market (start)
(5, 7, 2, 5),      -- Corporate Park
(5, 9, 3, 9),      -- City Hall
(5, 10, 4, 15);    -- Entertainment (end)

-- BGC-612 Corporate: Corporate → Gate → City Hall (3 stops)
INSERT INTO route_stops (route_id, stop_id, stop_order, arrival_time_offset_minutes) VALUES
(6, 7, 1, 0),      -- Corporate Park (start)
(6, 3, 2, 2),      -- BGC Gate
(6, 9, 3, 5);      -- City Hall (end)

-- BGC-725 Serendra: Serendra → High Street → Uptown → Back (4 stops)
INSERT INTO route_stops (route_id, stop_id, stop_order, arrival_time_offset_minutes) VALUES
(7, 8, 1, 0),      -- Serendra (start)
(7, 2, 2, 1),      -- High Street
(7, 4, 3, 3),      -- Uptown Drive
(7, 8, 4, 2);      -- Serendra (loop)

-- BGC-831 Downtown: Entertainment → City Hall → SM Aurora (3 stops)
INSERT INTO route_stops (route_id, stop_id, stop_order, arrival_time_offset_minutes) VALUES
(8, 10, 1, 0),     -- Entertainment (start)
(8, 9, 2, 8),      -- City Hall
(8, 1, 3, 20);     -- SM Aurora (end)

-- ============================================
-- OUTPUT VERIFICATION
-- ============================================
-- After running this script, verify with these queries:
--
-- Check routes loaded:
-- SELECT route_number, route_name, status, eta_minutes, current_capacity, max_capacity FROM routes;
--
-- Check stops loaded:
-- SELECT stop_name, stop_type, distance_km FROM bus_stops;
--
-- Check route-stop connections:
-- SELECT r.route_number, bs.stop_name, rs.stop_order, rs.arrival_time_offset_minutes 
-- FROM route_stops rs
-- JOIN routes r ON rs.route_id = r.id
-- JOIN bus_stops bs ON rs.stop_id = bs.id
-- ORDER BY r.route_number, rs.stop_order;
--
-- Expected count:
-- Routes: 8
-- Stops: 10
-- Route-Stop Connections: 29
-- ============================================
