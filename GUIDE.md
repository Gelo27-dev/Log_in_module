# NextStop Complete Setup Guide

Follow this guide to install and run NextStop on another Windows PC.

## Project Overview

NextStop is a Node.js and Express application for BGC bus tracking and user authentication. The frontend uses HTML, CSS, and browser JavaScript. The backend uses Express, MySQL, sessions, bcrypt, Nodemailer, and Passport OAuth.

## Main Files

- `server.js`: Express server, API routes, sessions, login, registration, password reset, and OAuth callbacks.
- `db.js`: MySQL connection pool.
- `script.js`: Frontend form handling, notifications, session checks, and OAuth button behavior.
- `style.css`: Shared frontend styling.
- `index.html`: Landing page.
- `log_in.html`: Login page with Google and Facebook buttons.
- `sign_in.html`: Account registration page.
- `dashboard.html`: Authenticated dashboard.
- `forgot_pass.html`: Password reset request page.
- `reset_pass.html`: New password page.
- `database.sql`: Database and `users` table definition.
- `setup-db.js`: Creates the database from `database.sql`.
- `.env.example`: Environment variable template.
- `.env`: Local secrets and settings. Never commit this file.
- `GUIDE.md`: Installation and configuration instructions.

## Before Editing

1. Check the current branch and working tree:

```powershell
git status --short
git branch --show-current
```

1. Read the relevant file and its nearby callers before changing it.
1. Preserve existing user changes. Do not reset or overwrite unrelated work.
1. Keep changes focused on the requested behavior.
1. Do not place passwords, API keys, OAuth secrets, or database credentials in tracked files.

## Local Setup

1. Open XAMPP Control Panel and start **Apache** and **MySQL**.
1. Open PowerShell and move to the project folder:

```powershell
cd C:\xampp\htdocs\Nextstop
```

1. Install the project dependencies:

```powershell
npm install
```

1. Start the application:

```powershell
node server.js
```

1. Keep the PowerShell window open and open `http://localhost:3000` in a browser.

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
```

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
1. Choose `database.sql` from this repository.
1. Click **Import** or **Go**.
1. Confirm that the `nextstop_db` database and `users` table appear in the left sidebar.

You can also create a new database from PowerShell:

```powershell
cd C:\xampp\htdocs\Nextstop
node setup-db.js
```

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

The backup contains the current user records. `database.sql` defines the table structure but may not contain the current user data.

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
