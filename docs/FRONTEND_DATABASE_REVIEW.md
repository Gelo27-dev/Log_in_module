# 🎨 FRONTEND & DATABASE REVIEW - NextStop BGC

---

## 📱 FRONTEND LOGIC REVIEW (`client/js/script.js`)

### Section 1: Password Visibility Toggle (Lines 1-40)

```javascript
document.addEventListener("DOMContentLoaded", () => {
  const passwordInputs = document.querySelectorAll('input[type="password"]');

  passwordInputs.forEach((input) => {
    // Skip if already has toggle
    if (input.closest(".password-toggle-wrapper")) {
      return;
    }

    // Create wrapper div
    const wrapper = document.createElement("div");
    wrapper.className = "password-toggle-wrapper";
    // ... move input into wrapper

    // Create toggle button
    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "password-toggle";
    // ... add eye icon SVG

    // Toggle password visibility
    toggleButton.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      toggleButton.classList.toggle("visible", isHidden);
    });
  });
});
```

**What This Does**:

1. Finds all password input fields on the page
2. For each one, adds an "eye" icon button next to it
3. Clicking the eye toggles between showing/hiding the password

**Security Benefit**: Users can verify they typed their password correctly before submitting.

**Accessibility**: Uses `aria-label` so screen readers know what the button does.

---

### Section 2: Password Strength Indicator (Lines 42-100)

```javascript
const getPasswordStrength = (value) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return { score: 0, label: "Start typing", color: "#d93025" };
  }

  let score = 0;

  // Length scoring
  if (trimmedValue.length >= 8) score += 25;
  if (trimmedValue.length >= 12) score += 15;

  // Character type scoring
  if (/[A-Z]/.test(trimmedValue)) score += 20; // Has uppercase
  if (/[a-z]/.test(trimmedValue)) score += 20; // Has lowercase
  if (/\d/.test(trimmedValue)) score += 10; // Has number
  if (/[^A-Za-z0-9]/.test(trimmedValue)) score += 10; // Has special char

  if (score > 100) score = 100;

  // Determine strength level
  let label = "Weak";
  let color = "#d93025"; // Red

  if (score >= 80) {
    label = "Strong";
    color = "#2d967f"; // Green
  } else if (score >= 55) {
    label = "Medium";
    color = "#f59e0b"; // Orange
  }

  return { score, label, color };
};
```

**Scoring System**:

- Minimum length (8 chars): +25 points
- Longer password (12+ chars): +15 bonus points
- Uppercase letter: +20 points
- Lowercase letter: +20 points
- Number: +10 points
- Special character (!@#$%): +10 points
- **Max: 100 points**

**Strength Levels**:

- **Weak** (0-54): Red bar 🔴
- **Medium** (55-79): Orange bar 🟠
- **Strong** (80-100): Green bar 🟢

**Example Passwords**:

- "password" = 45 (8 chars + lowercase + number) → **Weak** ❌
- "Password123" = 85 (12 chars + upper + lower + number) → **Strong** ✅
- "P@ssw0rd!" = 95 (12 chars + all types) → **Strong** ✅

**Real-time Feedback**: Updates as user types, so they know immediately if their password is strong enough.

---

## 🗄️ DATABASE REVIEW

### Connection Pool Setup (`server/config/database.js`)

```javascript
const db = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "nextstop_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  decimalNumbers: true,
  supportBigNumbers: true,
  bigNumberStrings: false,
});
```

**Key Settings**:

| Setting                    | Value                   | Purpose                           |
| -------------------------- | ----------------------- | --------------------------------- |
| `connectionLimit: 10`      | Max 10 connections      | Prevents server overload          |
| `waitForConnections: true` | Queue requests          | Don't drop requests when at limit |
| `queueLimit: 0`            | Unlimited queue         | No limit on waiting requests      |
| `enableKeepAlive: true`    | Keeps connections alive | Reuses connections (faster)       |
| `decimalNumbers: true`     | Decimal as number       | For money fields                  |
| `supportBigNumbers: true`  | Support large IDs       | For high-volume databases         |

**How Connection Pooling Works**:

```
User 1 Request ─┐
User 2 Request ─├─> Pool of 10 Connections ─> MySQL Database
User 3 Request ─┴─> (Reuses connections)
```

Instead of creating a new connection for each request (slow), the pool maintains 10 connections that are reused.

### Connection Error Handling (`server/config/database.js`)

```javascript
db.getConnection((err, connection) => {
  if (err) {
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      console.error("[DATABASE] Connection was closed...");
    }
    if (err.code === "ERR_CONNECTION_REFUSED") {
      console.error(
        "[DATABASE] Connection was refused. Ensure XAMPP MySQL is running...",
      );
    }
    if (err.code === "ER_BAD_DB_ERROR") {
      console.error("[DATABASE] Database 'nextstop_db' does not exist...");
    }
  } else {
    console.log("[DATABASE] [SUCCESS] Successfully connected to MySQL (XAMPP)");
    connection.release();
  }
});
```

**Error Types**:

1. **PROTOCOL_CONNECTION_LOST**: Server crashed or connection dropped
2. **ERR_CONNECTION_REFUSED**: MySQL service isn't running
3. **ER_BAD_DB_ERROR**: Database doesn't exist

**Message**: Each error tells you exactly what to do to fix it.

### Promises Support

```javascript
module.exports = db.promise();
```

This converts the MySQL callback-style API to async/await:

**Before (Callbacks)**:

```javascript
db.query(sql, values, (err, results) => {
  if (err) throw err;
  // use results
});
```

**After (Promises/Async)**:

```javascript
const [results] = await db.query(sql, values);
// use results directly
```

The `.promise()` conversion makes code much cleaner and easier to read.

---

## 📦 DEPENDENCIES REVIEW (package.json)

```json
{
  "dependencies": {
    "axios": "^1.19.0", // HTTP client
    "bcrypt": "^6.0.0", // Password hashing
    "cors": "^2.8.6", // Cross-Origin requests
    "dotenv": "^17.4.2", // Environment variables
    "express": "^5.2.1", // Web framework
    "express-rate-limit": "^8.6.2", // Rate limiting
    "express-session": "^1.19.0", // Session management
    "mysql2": "^3.23.3", // MySQL driver
    "nodemailer": "^9.0.5", // Email sending
    "passport": "^0.7.0", // Authentication
    "passport-facebook": "^3.0.0", // Facebook OAuth
    "passport-google-oauth20": "^2.0.0" // Google OAuth
  }
}
```

### Why Each Dependency?

| Package                   | Purpose                     | Status                          |
| ------------------------- | --------------------------- | ------------------------------- |
| `express`                 | Web server framework        | ✅ Core - Essential             |
| `bcrypt`                  | Password encryption         | ✅ Security - Critical          |
| `mysql2`                  | Database driver             | ✅ Core - Essential             |
| `express-session`         | User sessions               | ✅ Core - Essential             |
| `passport`                | Authentication framework    | ✅ Core - Essential             |
| `passport-google-oauth20` | Google login                | ✅ Feature                      |
| `passport-facebook`       | Facebook login              | ✅ Feature                      |
| `nodemailer`              | Send emails                 | ✅ Feature (password reset)     |
| `dotenv`                  | Config management           | ✅ Security - Important         |
| `cors`                    | Allow cross-origin requests | ⚠️ Installed but check usage    |
| `express-rate-limit`      | Prevent brute-force         | ⚠️ Installed but NOT configured |
| `axios`                   | HTTP client                 | ❓ Unclear - may not be used    |

### Installed But Not Configured

#### express-rate-limit

**Status**: Installed but not used in `server/app.js`

**Recommendation**: Add rate limiting to login endpoint:

```javascript
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 login attempts per IP
  message: "Too many login attempts, please try again later.",
});

app.post("/api/login", loginLimiter, async (req, res) => {
  // Login logic
});
```

#### cors

**Current Status**: No CORS configuration in `server/app.js`

**What It Does**: Allows requests from other domains:

```javascript
const cors = require("cors");

app.use(
  cors({
    origin: "http://localhost:3000", // Allow only your frontend
    credentials: true,
  }),
);
```

**Important for Production**:

- ✅ Installed for future use
- ⚠️ Currently allows ALL origins (probably fine for internal)
- 🔒 Should restrict to your domain in production

---

## 📊 HTML PAGES STRUCTURE

### `client/pages/index.html`

- **Purpose**: Landing page
- **Access**: Public (no login required)
- **Features**: Product info, CTA buttons to login/signup

### `client/pages/log_in.html`

- **Purpose**: User login
- **Fields**: Email/Username + Password
- **Features**:
  - OAuth buttons (Google, Facebook)
  - "Forgot Password" link
  - "Sign up" link

### `client/pages/sign_in.html`

- **Purpose**: User registration
- **Fields**: Username, Email, Location, Birthday, Phone, Password (with strength indicator)
- **Features**:
  - Real-time password strength feedback
  - Show/hide password toggle
  - Terms acceptance checkbox

### `client/pages/dashboard.html`

- **Purpose**: Main app (authenticated)
- **Access**: Login required
- **Features**:
  - View bus routes
  - View bus stops on map
  - Log trips (from → to stops)
  - Submit feedback with rating
  - View travel history
  - View feedback history
  - Audit logs (login history, etc.)

### `client/pages/forgot_pass.html`

- **Purpose**: Password reset request
- **Fields**: Email address
- **Process**: Sends reset link to email

### `client/pages/reset_pass.html`

- **Purpose**: Password reset form
- **Fields**: New password + confirm password
- **Parameter**: `?token=XXX` (from email link)
- **Features**:
  - Password strength indicator
  - Validation

---

## 🔐 SECURITY CHECKLIST

### ✅ IMPLEMENTED

- [x] Password hashing (bcrypt with salt rounds: 10)
- [x] Account lockout (5 failed attempts → 30-minute lock)
- [x] Session timeout (20 minutes inactivity)
- [x] Parameterized SQL queries (prevents injection)
- [x] OAuth support (Google, Facebook)
- [x] Audit logging (all actions tracked)
- [x] Password reset tokens (1-hour expiry)
- [x] Show/hide password toggle
- [x] Password strength indicator
- [x] Error message ambiguity (doesn't reveal which part is wrong)
- [x] HTTPS ready (secure: false for localhost, true for production)

### ⚠️ PARTIALLY IMPLEMENTED

- [x] Rate limiting installed but NOT CONFIGURED
- [x] CORS installed but NOT CONFIGURED
- [x] Database error handling (good but could be more specific)
- [ ] Input validation (frontend only, backend should validate too)
- [ ] Admin role system (marked TODO)

### ❌ MISSING

- [ ] CSRF protection (might need for forms)
- [ ] Security headers (X-Frame-Options, Content-Security-Policy, etc.)
- [ ] API key authentication (if needed)
- [ ] 2FA (two-factor authentication)
- [ ] Password requirements enforced on backend
- [ ] Email verification on registration
- [ ] Refresh tokens for OAuth

---

## 📈 PERFORMANCE CONSIDERATIONS

### Database Connection Pool

- ✅ 10 connections = good for ~20-50 concurrent users
- ⚠️ Might need more for high traffic

### Query Optimization

- ✅ Queries use indexes (route_number, email, etc.)
- ⚠️ Should verify indexes on: user_id, route_id (foreign keys)

### Caching Opportunities

- Routes don't change often → could cache for 1 hour
- Stops don't change often → could cache for 1 hour
- User's own data must be fresh → don't cache

### Pagination

- ✅ Audit endpoints use LIMIT/OFFSET (good for large datasets)
- ✅ History endpoints limit to 20 records (good)

---

## 🎯 CODE QUALITY SCORE

| Category              | Score  | Notes                                                                  |
| --------------------- | ------ | ---------------------------------------------------------------------- |
| **Security**          | 8.5/10 | Strong password handling, audit logs, but rate limiting not configured |
| **Error Handling**    | 8/10   | Good database error messages, some endpoints missing error handling    |
| **Code Organization** | 8.5/10 | Middleware well-organized, helper functions extracted                  |
| **Documentation**     | 6/10   | Code has some comments, but complex functions could use more           |
| **Testing**           | N/A    | No automated tests visible (consider adding Jest/Mocha)                |
| **Performance**       | 7.5/10 | Connection pool good, but could optimize queries and add caching       |

**Overall**: 8/10 for the reviewed local-development implementation; do not treat this as a production-readiness approval.

---

## 🚀 QUICK WINS (Easy Improvements)

### 1. Configure Rate Limiting (10 minutes)

```javascript
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts",
});

app.post("/api/login", loginLimiter, async (req, res) => {
  // ...
});
```

### 2. Add Password Validation on Backend (5 minutes)

```javascript
const validatePassword = (password) => {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  return (
    hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial
  );
};
```

### 3. Configure CORS (5 minutes)

```javascript
const cors = require("cors");

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
```

### 4. Add Security Headers (5 minutes)

```javascript
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});
```

---

## 📝 RECOMMENDATIONS

### HIGH PRIORITY

1. **Implement Admin Role Check** - Currently marked TODO
2. **Backend Password Validation** - Frontend-only validation can be bypassed
3. **Configure Rate Limiting** - Already installed, just needs setup

### MEDIUM PRIORITY

1. **Email Verification** - Confirm user owns the email
2. **Add HTTPS in Production** - Currently `secure: false`
3. **Database Indexes** - Verify all foreign keys are indexed

### LOW PRIORITY

1. **Add Unit Tests** - Jest/Mocha
2. **API Documentation** - Swagger/OpenAPI
3. **Logging Service** - Winston or Pino for better logging
4. **Caching Layer** - Redis for sessions and frequently accessed data

---

**Last Updated**: September 6, 2026
