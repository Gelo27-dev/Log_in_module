-- Sample Routes for NextStop BGC
INSERT INTO routes (route_number, route_name, route_color, start_location, end_location, start_lat, start_lng, end_lat, end_lng, status, eta_minutes, frequency_minutes, current_capacity, max_capacity) VALUES
('BGC-101', 'BGC Express', '#2d967f', 'SM Aurora Premier', 'High Street Central', 14.5515, 121.0505, 14.5625, 121.0555, 'ON_TIME', 4, 8, 12, 40),
('BGC-204', 'Uptown Shutter', '#1976d2', 'SM Aurora Premier', 'High Street Central', 14.5515, 121.0505, 14.5625, 121.0555, 'ON_TIME', 7, 12, 28, 40),
('BGC-317', 'Venice Loop', '#f59e0b', 'SM Aurora Premier', 'High Street Central', 14.5515, 121.0505, 14.5625, 121.0555, 'DELAY', 11, 15, 6, 40),
('BGC-409', 'Bonifacio Link', '#7c3aed', 'SM Aurora Premier', 'High Street Central', 14.5515, 121.0505, 14.5625, 121.0555, 'ON_TIME', 3, 10, 33, 40);

-- Sample Bus Stops
INSERT INTO bus_stops (stop_name, latitude, longitude, stop_type, distance_km, is_active) VALUES
('SM Aurora Premier', 14.5515, 121.0505, 'Active stop', 0, 1),
('High Street Central', 14.5625, 121.0555, 'Popular stop', 1.2, 1),
('Bonifacio Global City Gate', 14.5700, 121.0600, 'Transfer hub', 2.5, 1),
('Uptown Drive', 14.5450, 121.0450, 'Active stop', 1.5, 1),
('McKinley Hill', 14.5350, 121.0350, 'Active stop', 3.2, 1);

-- Link routes to stops
INSERT INTO route_stops (route_id, stop_id, stop_order, arrival_time_offset_minutes) VALUES
(1, 1, 1, 0),
(1, 2, 2, 4),
(1, 3, 3, 8),
(2, 1, 1, 0),
(2, 2, 2, 7),
(2, 4, 3, 12),
(3, 1, 1, 0),
(3, 2, 2, 11),
(3, 5, 3, 15),
(4, 1, 1, 0),
(4, 4, 2, 3),
(4, 3, 3, 6);
