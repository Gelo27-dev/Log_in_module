# NextStop Complete Setup Guide

Follow this guide to install and run NextStop on another Windows PC.

## Project Overview

NextStop is a Node.js and Express application for BGC bus tracking and user authentication. The frontend uses HTML, CSS, and browser JavaScript. The backend uses Express, MySQL, sessions, bcrypt, Nodemailer, and Passport OAuth.

### Features Included

- ✅ User Authentication (Register, Login, OAuth)
- ✅ Password Reset via Email
- ✅ Dashboard with Route & Map View
- ✅ Bus Stops Directory
- ✅ Travel History Tracking
- ✅ User Feedback System
- ✅ Session Management

## Main Files

### Core Files

- `server.js`: Startup launcher.
- `server/app.js`: Express server, API routes, sessions, login, registration, password reset, and OAuth callbacks.
- `server/config/database.js`: MySQL connection pool.
- `client/js/script.js`: Frontend form handling, notifications, session checks, and OAuth button behavior.
- `client/css/style.css`: Shared frontend styling.

### HTML Pages

- Pages are stored in `client/pages/`: landing, login, registration, dashboard, and password reset pages.
- Shared browser assets are stored in `client/js/`, `client/css/`, and `client/assets/`.

### Database Files

- `database/database.sql`: Database and all table definitions (users, routes, bus_stops, travel_history, feedback, route_stops).
- `database/sample-data.sql`: Sample routes, stops, and route connections.
- `database/setup.js`: Creates the database from `database/database.sql`.

### Configuration Files

- `.env.example`: Environment variable template.
- `.env`: Local secrets and settings. Never commit this file.
- `GUIDE.md`: Installation and configuration instructions.
- `CODEBASE_WALKTHROUGH.md`: Detailed explanation of the application flow and file connections.
- `package.json`: Project dependencies.

## Before Editing

1. Check the current branch and working tree:

```powershell
git status --short
git branch --show-current
```

2. Read the relevant file and its nearby callers before changing it.
3. Preserve existing user changes. Do not reset or overwrite unrelated work.
4. Keep changes focused on the requested behavior.
5. Do not place passwords, API keys, OAuth secrets, or database credentials in tracked files.

## Local Setup

### 1. Start Database Server

Open XAMPP Control Panel and start **Apache** and **MySQL**.

### 2. Navigate to Project Folder

Open PowerShell and move to the project folder:

```powershell
cd C:\xampp\htdocs\Nextstop
```

### 3. Install Dependencies

Install the project dependencies:

```powershell
npm install
```

### 4. Set Up Database

Create the database and tables by running:

```powershell
npm run setup-db
```

This creates the `nextstop_db` database with all required tables.

### 5. (Optional) Load Sample Data

To populate sample bus routes and stops, run in phpMyAdmin or MySQL CLI:

```sql
-- Source the sample data file
source database/sample-data.sql;
```

Or use MySQL command line:

```powershell
mysql -u root nextstop_db < database/sample-data.sql
```

### 6. Configure Environment

Create or update the `.env` file with your settings (see **Environment** section below).

### 7. Start the Application

```powershell
npm start
```

The application will display:

```
[SYSTEM] NextStop Server Started!
[SYSTEM] Running on http://localhost:3000
[DATABASE] [SUCCESS] Successfully connected to MySQL (XAMPP)
```

Keep the PowerShell window open.

### 8. Open in Browser

Visit `http://localhost:3000` in your browser:

- **New Users**: Click "Create Account" on the login page
- **Existing Users**: Enter your credentials
- **After Login**: You'll be redirected to the dashboard

## Dashboard Features

### Routes & Map View

- View all active bus routes with real-time status
- See route names, numbers, start/end locations
- Check ETA, frequency, and capacity
- Interactive map showing route locations
- Real-time bus status indicators

### Bus Stops

- Browse all active bus stops
- View stop types (Active stop, Transfer hub, etc.)
- See distance information

### Feedback System

- Submit feedback about bus service
- Rate routes (1-5 stars)
- Categorize feedback (Service, Timing, Cleanliness, etc.)
- View your previous feedback submissions

### Travel History

- Automatic tracking of bus trips
- View trip dates, times, and routes
- Historical record of all journeys

## API Endpoints

### Authentication

- `POST /api/register` - Create new account
- `POST /api/login` - Log in to account
- `POST /api/logout` - Log out of account
- `GET /api/session` - Check session status
- `POST /api/forgot-password` - Request password reset
- `POST /api/reset-password` - Reset password with token

### Dashboard

- `GET /api/routes` - Get all active bus routes
- `GET /api/routes/:id` - Get route details with stops
- `GET /api/stops` - Get all bus stops
- `GET /api/history` - Get user's travel history
- `POST /api/history` - Log a trip to history
- `GET /api/feedback` - Get user's feedback submissions
- `POST /api/feedback` - Submit new feedback

## Database Schema

### users

Stores user account information and authentication credentials.

### routes

Contains bus route information including name, number, color, start/end locations, status, and capacity.

### bus_stops

Stores all bus stop locations with coordinates and type information.

### travel_history

Records all trips taken by users with timestamps and route information.

### feedback

Stores user feedback submissions with optional ratings and categories.

### route_stops

Maps which stops belong to which routes in a specific order.

## Environment

The application reads settings from a private `.env` file in the project folder:

```text
C:\xampp\htdocs\Nextstop\.env
```

When moving from the old PC, copy the actual `.env` file separately using a private USB drive or a secure file transfer. Do not put it in the GitHub repository or inside this guide. On the new PC, place it beside `server.js` before running `node server.js`.

If you do not have the old `.env` file, create a new one and paste this configuration:

```env
# Server Configuration
PORT=3000
SESSION_SECRET=nextstop_bgc_enterprise_secure_key_2026

# Database Configuration (XAMPP MySQL)
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=nextstop_db
DB_PORT=3306

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM="NextStop BGC <noreply@nextstopbgc.com>"

# OAuth Configuration (Google)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# OAuth Configuration (Facebook)
FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_APP_SECRET=your_facebook_app_secret_here
FACEBOOK_CALLBACK_URL=http://localhost:3000/api/auth/facebook/callback
```

## Troubleshooting

### Database Connection Error

- Ensure XAMPP MySQL is running (green indicator in XAMPP panel)
- Check that `localhost:3306` is accessible
- Verify `DB_HOST`, `DB_USER`, and `DB_PASS` in `.env`

### Database Not Found

- Run `npm run setup-db` to create the database
- Verify the file exists: `database/database.sql`

### Email Not Sending

- Gmail requires an "App Password" (not your regular Gmail password)
- Generate one at: https://myaccount.google.com/apppasswords
- Store the 16-character password in `EMAIL_PASS` in `.env`

### OAuth Not Working

- Ensure you have valid Google/Facebook app credentials
- Update `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `.env`
- Update `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` in `.env`
- Restart the server after changing `.env`

### Session Timeout

- Default session timeout is 20 minutes
- Sessions are stored in browser cookies
- Inactivity will require re-login

## Testing Checklist

- [ ] Server starts without errors
- [ ] Can access `http://localhost:3000`
- [ ] Can create a new account
- [ ] Can log in with new account
- [ ] Dashboard loads with routes
- [ ] Can view bus stops
- [ ] Can submit feedback
- [ ] Can view travel history
- [ ] Map displays route locations
- [ ] Can log out successfully

## Development Notes

- **Session Duration**: 20 minutes of inactivity
- **Max Capacity**: 40 passengers per bus
- **Route Colors**: Green (#2d967f), Blue (#1976d2), Orange (#f59e0b), Purple (#7c3aed)
- **Database**: MySQL via XAMPP
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Authentication**: Sessions + bcrypt password hashing
- **OAuth Providers**: Google and Facebook
  FACEBOOK_APP_SECRET=your_facebook_app_secret_here

````

Replace the placeholders with the real values from the old private `.env` file when email or OAuth login is needed. For a basic local test, the database values are enough. Do not put real passwords or OAuth secrets in this guide.

Google and Facebook login require real provider credentials. The local callback URLs are:

- `http://localhost:3000/api/auth/google/callback`
- `http://localhost:3000/api/auth/facebook/callback`

Facebook also supports `FACEBOOK_CALLBACK_URL` in `.env`.

## Database

The expected database is `nextstop_db` with a `users` table.

### Create a New Database

1. Open XAMPP and start MySQL.
1. Open `http://localhost/phpmyadmin`.
1. Select the **Import** tab.
1. Choose `database/database.sql` from this repository.
1. Click **Import** or **Go**.
1. Confirm that the `nextstop_db` database and `users` table appear in the left sidebar.

You can also create a new database from PowerShell:

```powershell
cd C:\xampp\htdocs\Nextstop
npm run setup-db
````

Do not use both methods for the same new database. Choose one method.

### SQL to Paste in XAMPP

In phpMyAdmin, open the **SQL** tab, paste this code, and click **Go**:

```sql
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
```

This creates the database and table without deleting existing records. If the table already exists, `CREATE TABLE IF NOT EXISTS` will not modify its structure.

### Backup the Database

Before changing the database, export a backup in phpMyAdmin:

1. Select `nextstop_db`.
1. Select the **Export** tab.
1. Choose **Quick** and format **SQL**.
1. Click **Export** and store the downloaded file somewhere safe.

The backup contains the current user records. `database/database.sql` defines the table structure but may not contain the current user data.

### Restore a Backup

1. Start MySQL in XAMPP.
1. Open phpMyAdmin and select `nextstop_db`.
1. Open the **Import** tab.
1. Select the exported `.sql` backup file.
1. Click **Import** or **Go**.
1. Refresh phpMyAdmin and confirm that the `users` table and records are present.

### Verify the Database

Run these queries in phpMyAdmin under the **SQL** tab:

```sql
USE nextstop_db;
SHOW TABLES;
DESCRIBE users;
SHOW INDEX FROM users;
```

The `users` table should contain the authentication, password reset, Google OAuth, and Facebook OAuth columns. `id`, `username`, and `email` must have unique keys. `google_id` and `facebook_id` should also have unique keys.

If the OAuth keys are missing, run this once after checking that there are no duplicate non-empty values:

```sql
USE nextstop_db;

ALTER TABLE users
  ADD UNIQUE KEY google_id_unique (google_id),
  ADD UNIQUE KEY facebook_id_unique (facebook_id);
```

Do not run destructive SQL against an existing database without exporting a backup first. When changing the schema, update both the SQL definition and the live database migration procedure.

## Validation After Changes

Run the narrowest relevant check first. For JavaScript changes:

```powershell
node --check server.js
node --check script.js
```

For authentication or database changes, start the server with XAMPP MySQL running and test registration, login, logout, password reset, and the affected OAuth flow.

For frontend changes, refresh the affected page and check both desktop and mobile layouts.

Before finishing, inspect the change list:

```powershell
git diff --stat
git status --short
```

## Change Rules

- Keep the existing CommonJS Node.js style.
- Use parameterized SQL queries.
- Hash passwords with bcrypt; never store plaintext passwords.
- Keep OAuth secrets in `.env` only.
- Do not commit `node_modules`.
- Do not delete setup or application files unless they are confirmed unused.
- Avoid unrelated formatting changes.
