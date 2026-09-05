# NextStop Codebase Walkthrough

This document explains how the application is connected.

## 1. Start With The Big Picture

NextStop has four layers:

```text
Browser pages
  client/pages/*.html
        |
        | loads
        v
Browser JavaScript and CSS
  client/js/script.js
  client/css/style.css
        |
        | fetch('/api/...') over HTTP
        v
Express server
  server.js -> server/app.js
        |
        | calls
        v
MySQL connection pool
  server/config/database.js
        |
        v
MySQL tables
  database/database.sql
  database/audit-database.sql
```

The browser does not call MySQL directly. It sends HTTP requests to Express. Express checks the session, runs a parameterized SQL query, and sends JSON back to the browser.

## 2. What Runs First

### `server.js`

The root [server.js](../server.js) is intentionally small:

```javascript
require("./server/app");
```

This line loads the real application. Keeping this launcher means both `node server.js` and `npm start` remain familiar commands.

### `server/app.js` startup

Read [server/app.js](../server/app.js) from top to bottom. JavaScript executes this file in order.

| Section         | What the lines do                                              | Why it matters                                                                                                   |
| --------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Lines 1-11      | Import Node.js modules and installed packages.                 | These imports provide HTTP routing, sessions, file paths, encryption helpers, email, OAuth, and database access. |
| Lines 13-14     | Create the Express app and select the port.                    | `process.env.PORT` allows deployment configuration; `3000` is the local fallback.                                |
| Lines 16-26     | Register an `uncaughtException` listener.                      | It prints unexpected errors and gives a specific hint for common MySQL connection failures.                      |
| Lines 28-42     | Create the Nodemailer transporter.                             | Password reset email delivery uses Gmail SMTP. Credentials come from `.env`, not source code.                    |
| Lines 44-45     | Enable JSON and URL-encoded request parsing.                   | Without these middleware functions, `req.body` would usually be empty for form and JSON requests.                |
| Lines 47-57     | Configure `express-session`.                                   | The server stores login state in a session cookie and session record.                                            |
| Lines 59-60     | Initialize Passport.                                           | Passport can read and write OAuth login state.                                                                   |
| Lines 63-146    | Define shared authentication, IP, audit, and password helpers. | Route handlers reuse these functions instead of repeating the same low-level work.                               |
| Lines 149-273   | Conditionally configure Google and Facebook OAuth.             | The strategies only exist when the required `.env` values are present.                                           |
| Lines 275-285   | Configure Passport serialization.                              | Only the user ID is stored in the Passport session; the user record is loaded later.                             |
| Lines 288-292   | Mount frontend directories.                                    | URL paths such as `/css/style.css` map to files under `client/css`.                                              |
| Lines 294-328   | Add inactivity timeout and database error middleware.          | These run for later requests and protect the API from expired sessions or raw database errors.                   |
| Lines 330-884   | Define authentication and account endpoints.                   | Registration, login, logout, password reset, OAuth callbacks, and configuration live here.                       |
| Lines 886-1098  | Define dashboard endpoints.                                    | Routes, stops, history, and feedback are read or written here.                                                   |
| Lines 1100-1354 | Define audit endpoints.                                        | These return login, session, account, trip, feedback, system, and API audit records.                             |
| Lines 1356-1358 | Serve the landing page at `/`.                                 | Express sends `client/pages/index.html`.                                                                         |
| Lines 1360-end  | Start listening and print a route summary.                     | The process begins accepting HTTP requests.                                                                      |

## 3. Middleware Order Is Important

Express runs middleware in the order it is registered. The effective order is:

```text
request
  -> JSON/form body parsing
  -> session creation or session lookup
  -> Passport initialization
  -> Passport session lookup
  -> static file lookup
  -> inactivity timeout check
  -> route handler
  -> database error handler when an error is passed to next(error)
  -> response
```

A route declared earlier can behave differently from one declared later. When debugging, always check where the route appears in [server/app.js](../server/app.js), not only what the route handler contains.

### `req`, `res`, and `next`

Most handlers use these three Express objects:

- `req` is the incoming request. It contains `req.body`, `req.query`, `req.params`, headers, cookies, and session data.
- `res` is the outgoing response. `res.json(...)` sends JSON; `res.status(...).json(...)` sends JSON with a status code; `res.sendFile(...)` sends a file.
- `next` passes control to the next middleware. Calling `next(error)` moves to an error handler.

## 4. Shared Helpers

### Authentication helper

The `requireAuth` function near line 63 checks `req.session.loggedIn`.

```text
No loggedIn session value -> HTTP 401 -> route stops
Logged-in session        -> next()   -> route continues
```

Every protected dashboard and audit route uses it as a second argument:

```javascript
app.get("/api/routes", requireAuth, async (req, res) => {
```

This means the request must pass `requireAuth` before the async route callback runs.

### IP and audit helpers

`getRequestIp` reads `x-forwarded-for` first, then the direct socket address. This value is recorded for traceability.

`writeAudit` is the low-level helper. It runs a query and catches audit failures so an audit insert does not hide the main application result.

The three wrappers describe different audit tables:

- `writeGeneralAudit` inserts into `audit_logs`.
- `writeLoginAudit` inserts into `login_audit`.
- `writeAccountAudit` inserts into `account_audit`.

They all use `?` placeholders. The values are passed separately to MySQL, which is safer than constructing SQL with string concatenation.

### Temporary password helper

`generateTempPassword` creates a random 12-character password for a newly created OAuth account. It is hashed before being stored. The temporary plaintext value is only placed in the session so the user can retrieve it once.

## 5. Session And Login Connection

A normal login has this path:

```text
log_in.html
  -> client/js/script.js login handler
  -> POST /api/login
  -> SELECT users WHERE email = ? OR username = ?
  -> bcrypt.compare(entered password, stored hash)
  -> set req.session.loggedIn, userId, username
  -> INSERT login_audit and session_audit
  -> JSON success response
  -> browser redirects to dashboard.html
```

### Session setup

The session configuration sets:

- `secret`: signs the session ID cookie.
- `resave: false`: avoids saving an unchanged session repeatedly.
- `saveUninitialized: false`: avoids creating sessions before they are needed.
- `cookie.maxAge`: expires the cookie after 20 minutes.
- `cookie.secure: false`: allows local HTTP development. HTTPS deployments should use secure cookies.

The application also stores `lastActivity`. The inactivity middleware compares the current time with that value and destroys the session after 20 minutes without activity.

### Login failure flow

The login handler has several branches:

1. Missing username or password returns HTTP 400.
2. Unknown email or username writes a failed login audit and returns HTTP 400.
3. A locked account returns HTTP 403 until `lock_until` has passed.
4. A wrong password increments `failed_attempts`.
5. Five failed attempts set `account_locked = 1` for 30 minutes.
6. A correct password clears failed attempts and creates the logged-in session.

The important connection is that authentication state is stored in `req.session`, while account lock state is stored in the `users` table.

## 6. Registration And Password Reset

### Registration

`POST /api/register` receives fields from the registration page. The handler:

1. Checks required fields.
2. Confirms the two submitted passwords match.
3. Checks whether the username or email already exists.
4. Hashes the password with bcrypt.
5. Inserts the new user.
6. Writes account and general audit records.
7. Returns HTTP 201.

The password itself should never be inserted into SQL or written to an audit table. Only the bcrypt hash belongs in `users.password_hash`.

### Forgot password

The flow is:

```text
forgot_pass.html
  -> POST /api/forgot-password
  -> generate random reset token
  -> store token and one-hour expiry in users
  -> build reset_pass.html?token=...
  -> send email through Nodemailer
```

If email delivery fails, the current code logs the reset URL to the server console. That is useful locally but should be removed or replaced with a secure operational flow in production.

### Reset password

`POST /api/reset-password` receives `token` and `newPassword`, selects a user whose token is unexpired, hashes the new password, and clears the token fields. Clearing the token makes it single-use.

## 7. OAuth Connection

Google and Facebook are optional. The `if` blocks around lines 149 and 210 prevent OAuth routes from being registered when placeholder credentials are still in `.env`.

The OAuth flow is:

```text
browser clicks /api/auth/google
  -> provider login page
  -> provider redirects to /api/auth/google/callback
  -> Passport strategy finds or creates a users row
  -> callback sets the application session
  -> redirect to /dashboard.html
```

Passport has two separate concepts here:

- The strategy callback communicates with Google or Facebook and returns a user.
- `serializeUser` and `deserializeUser` connect Passport's session mechanism to the `users` table.

The application also sets its own `req.session.loggedIn` values. When reading this code, keep those two session mechanisms conceptually separate.

## 8. Dashboard API Connections

The dashboard code in [dashboard.html](../client/pages/dashboard.html) uses `fetch` to call these server routes:

| Browser action      | Request                    | Database source                           |
| ------------------- | -------------------------- | ----------------------------------------- |
| Load route cards    | `GET /api/routes`          | `routes`                                  |
| Load bus stops      | `GET /api/stops`           | `bus_stops`                               |
| Open route details  | `GET /api/routes/:routeId` | `routes`, `route_stops`, `bus_stops`      |
| Load travel history | `GET /api/history`         | `travel_history`, `routes`                |
| Save a trip         | `POST /api/history`        | inserts `travel_history` and `trip_audit` |
| Load feedback       | `GET /api/feedback`        | `feedback`, `routes`                      |
| Submit feedback     | `POST /api/feedback`       | inserts `feedback` and `feedback_audit`   |
| Check login state   | `GET /api/session`         | session only                              |
| Log out             | `POST /api/logout`         | session plus audit updates                |

All dashboard routes use `requireAuth`, so a browser request without the session cookie receives HTTP 401.

### Why `routeId` appears in the URL

`/api/routes/:routeId` uses an Express route parameter. For `/api/routes/4`, `req.params.routeId` is the string `"4"`. The SQL query receives it as a parameter rather than being concatenated into the query.

### Why joins are used

`travel_history` stores IDs and trip fields, while `routes` stores route names and numbers. The SQL `JOIN routes r ON th.route_id = r.id` combines those tables so the dashboard receives useful display data in one response.

## 9. Audit API Connections

Audit routes are read-only views over separate audit tables. Their job is to answer questions such as:

- When did a user log in?
- Which account field changed?
- Which trip was recorded?
- What feedback was submitted?
- Which sessions are still open?
- What API endpoints are slow or failing?

The user-scoped audit handlers use `req.session.userId` in their SQL `WHERE` clause. That is the connection that prevents one user from reading another user's feedback, trips, account changes, or sessions.

Several handlers contain TODO comments for admin role checks. Those comments are important: the route names say "Admin", but a complete role check is not yet implemented in every admin-labelled endpoint.

## 10. Frontend Files

### HTML pages

Each page in `client/pages` provides structure and form controls. Typical connections are:

```html
<link rel="stylesheet" href="/css/style.css" />
<script src="/js/script.js" defer></script>
```

The leading slash means the browser requests these from the site root. Express maps them through the mounts in `server/app.js`.

Forms usually provide IDs and names. `script.js` finds those elements with `document.getElementById`, reads values, calls `fetch`, and updates the page.

### `client/js/script.js`

Read this file in groups:

- The first section defines DOM helpers and notification behavior.
- The login section collects `emailUsername` and `password`, then posts to `/api/login`.
- The registration section collects the form fields, checks password strength, then posts to `/api/register`.
- The password sections post to `/api/forgot-password` and `/api/reset-password`.
- The session section calls `/api/session` and redirects unauthenticated dashboard visitors.
- The config section calls `/api/config` to hide or show OAuth buttons.

When tracing a button, start at the HTML element's `id`, find that ID in `script.js`, then follow the URL string into `server/app.js`.

### `client/css/style.css`

CSS does not control database behavior. It controls visual layout, colors, typography, responsive behavior, and the background image. The `url("../assets/bgc-bg.png")` path is relative to `client/css/style.css`, which is why it goes up one directory before entering `assets`.

## 11. Database Files

### Main schema

[database/database.sql](../database/database.sql) defines the application tables. The important relationships are:

```text
users 1 ---- many travel_history
users 1 ---- many feedback
routes 1 ---- many travel_history
routes many - many bus_stops through route_stops
```

The foreign keys in the SQL schema enforce those relationships.

### Audit schema

[database/audit-database.sql](../database/audit-database.sql) contains tables that record actions rather than current application state. For example, `users.account_locked` tells the current lock state, while `account_audit` records how that state changed over time.

### Database connection

[server/config/database.js](../server/config/database.js) creates a MySQL pool. A pool keeps several reusable connections instead of opening a new TCP connection for every query.

The server imports it with:

```javascript
const db = require("./config/database");
```

Every `await db.query(...)` in `server/app.js` uses this shared pool.

### Database setup

[database/setup.js](../database/setup.js) is a command-line script, not part of normal web requests. `npm run setup-db` loads `database/database.sql`, splits it into statements, executes them, and verifies that tables exist.

## 12. A Reliable Line-By-Line Reading Method

Use this procedure for any feature:

1. Start at the visible control in `client/pages`.
2. Identify its `id`, `name`, or inline event handler.
3. Find that identifier or form handler in `client/js/script.js` or `dashboard.html`.
4. Write down the exact HTTP method and URL used by `fetch`.
5. Find the matching `app.get` or `app.post` in `server/app.js`.
6. Read middleware arguments before reading the route body. `requireAuth` may change the result before the handler runs.
7. Read the request inputs: `req.body`, `req.query`, and `req.params`.
8. Read each SQL query and list its table, placeholders, and returned columns.
9. Follow the response object back to the browser code.
10. Check which DOM element receives the result.

For a login example, the exact chain is:

```text
client/pages/log_in.html
  -> client/js/script.js: login form handler
  -> POST /api/login
  -> server/app.js: app.post("/api/login", ...)
  -> server/config/database.js: db.query(...)
  -> database/database.sql: users table
  -> JSON response
  -> redirect to dashboard.html
```

## 13. Useful Commands While Studying

```powershell
# Start the application
npm start

# Check JavaScript syntax without connecting to MySQL
npm test

# Run the database setup script
npm run setup-db

# Run the API integration script while the server is running
npm run test:api

# Find every API route
Select-String -Path server\app.js -Pattern 'app\.(get|post)'

# Find browser requests
Select-String -Path client\js\script.js,client\pages\dashboard.html -Pattern 'fetch\('
```

## 14. Important Things To Notice While Learning

- The server uses parameterized SQL values, which is the correct pattern for user input.
- Passwords are hashed with bcrypt; the original password should not be recoverable from the database.
- Authentication and authorization are not identical. `requireAuth` verifies that a user is logged in, but several admin endpoints still need a real role check.
- The current session store is the default in-memory Express store. It is acceptable for local learning but should be replaced for a multi-process or production deployment.
- `.env` contains secrets and should never be committed or copied into documentation.
- Audit writes are intentionally best-effort in the current implementation. A failed audit insert is logged but does not necessarily fail the main user action.
