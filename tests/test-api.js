#!/usr/bin/env node

/**
 * NEXTSTOP TEST SCRIPT
 *
 * Tests API endpoints and displays expected outputs
 *
 * Usage:
 *   npm run test:api
 *
 * Prerequisites:
 *   1. Start server: npm start
 *   2. Load test data: mysql -u root nextstop_db < database/test-data.sql
 *   3. Create test user (register or login)
 */

const axios = require("axios");

const BASE_URL = "http://localhost:3000";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

const log = {
  title: (text) =>
    console.log(`\n${colors.bold}${colors.cyan}═══ ${text} ═══${colors.reset}`),
  success: (text) => console.log(`${colors.green}✓ ${text}${colors.reset}`),
  error: (text) => console.log(`${colors.red}✗ ${text}${colors.reset}`),
  info: (text) => console.log(`${colors.blue}ℹ ${text}${colors.reset}`),
  warning: (text) => console.log(`${colors.yellow}⚠ ${text}${colors.reset}`),
};

// Store session for authenticated requests
let sessionCookie = "";

async function testEndpoint(method, endpoint, data = null, description = "") {
  try {
    const url = `${BASE_URL}${endpoint}`;
    const config = {
      method: method.toUpperCase(),
      url: url,
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);

    // Store session cookie
    if (response.headers["set-cookie"]) {
      sessionCookie = response.headers["set-cookie"][0];
    }

    log.success(`${method.toUpperCase()} ${endpoint} - ${response.status}`);
    if (description) {
      console.log(`  ${description}`);
    }
    console.log(`  Data: ${JSON.stringify(response.data, null, 2)}\n`);

    return response.data;
  } catch (error) {
    log.error(
      `${method.toUpperCase()} ${endpoint} - ${error.response?.status || "No connection"}`,
    );
    if (error.response?.data?.error) {
      console.log(`  Error: ${error.response.data.error}\n`);
    } else {
      console.log(`  Error: ${error.message}\n`);
    }
    return null;
  }
}

async function displayTable(data, title) {
  log.info(title);
  console.table(data);
}

async function runTests() {
  log.title("NEXTSTOP API TEST SUITE");

  // Test 1: Check session
  log.title("Test 1: Check Session Status");
  await testEndpoint("GET", "/api/session", null, "Check if user is logged in");

  // Test 2: Get all routes
  log.title("Test 2: Fetch All Routes");
  const routesResponse = await testEndpoint(
    "GET",
    "/api/routes",
    null,
    "Should return 8 test routes",
  );

  if (routesResponse && routesResponse.routes) {
    const routeSummary = routesResponse.routes.map((r) => ({
      "Route #": r.route_number,
      Name: r.route_name,
      Status: r.status,
      ETA: `${r.eta_minutes} min`,
      Freq: `${r.frequency_minutes} min`,
      Capacity: `${r.current_capacity}/${r.max_capacity}`,
      Color: r.route_color,
    }));
    displayTable(routeSummary, "Routes Summary:");
  }

  // Test 3: Get all stops
  log.title("Test 3: Fetch All Bus Stops");
  const stopsResponse = await testEndpoint(
    "GET",
    "/api/stops",
    null,
    "Should return 10 test stops",
  );

  if (stopsResponse && stopsResponse.stops) {
    const stopSummary = stopsResponse.stops.map((s) => ({
      "Stop Name": s.stop_name,
      Type: s.stop_type,
      Distance: `${s.distance_km} km`,
      Lat: s.latitude.toFixed(4),
      Lng: s.longitude.toFixed(4),
    }));
    displayTable(stopSummary, "Stops Summary:");
  }

  // Test 4: Get route details with stops
  log.title("Test 4: Fetch Single Route with Stops");
  const routeDetailsResponse = await testEndpoint(
    "GET",
    "/api/routes/1",
    null,
    "Route 1 (BGC-101) with stops",
  );

  if (routeDetailsResponse && routeDetailsResponse.stops) {
    const stopDetails = routeDetailsResponse.stops.map((s) => ({
      Order: s.stop_order,
      "Stop Name": s.stop_name,
      Type: s.stop_type,
      Arrival: `${s.arrival_time_offset_minutes} min`,
    }));
    displayTable(stopDetails, "Route Stops Detail:");
  }

  // Test 5: Check config (OAuth)
  log.title("Test 5: Check Configuration");
  await testEndpoint("GET", "/api/config", null, "Check OAuth status");

  // Test 6: Display summary
  log.title("Test Summary");
  console.log(`
${colors.green}Expected Test Results:${colors.reset}

1. Routes: Should show 8 routes
   - Mix of ON_TIME and DELAY statuses
   - ETAs ranging from 2-20 minutes
   - Capacities from 4/20 to 18/20

2. Bus Stops: Should show 10 stops
   - Different stop types (Active, Popular, Transfer hub, etc.)
   - Real BGC coordinates (14.54-14.61 lat, 121.01-121.05 lng)
   - Distances from 0 km to 3.5 km

3. Route Details: Should show ordered stops
   - Stop order (1, 2, 3, etc.)
   - Arrival time offsets (in minutes from start)

4. Configuration: Should show OAuth status
   - googleOAuthEnabled: true/false
   - facebookOAuthEnabled: true/false

${colors.yellow}Next Steps:${colors.reset}
1. Visit http://localhost:3000/dashboard.html
2. See 8 routes displayed
3. See interactive map with 8 markers
4. See 10 stops in Bus Stops view
5. Test feedback submission
6. Check travel history
  `);
}

// Run tests
runTests().catch((err) => {
  log.error(`Test suite failed: ${err.message}`);
  console.log(err);
  process.exit(1);
});
