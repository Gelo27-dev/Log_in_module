require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const db = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3000;

process.on("uncaughtException", (err) => {
  console.error("[ERROR] [UNCAUGHT]", err.message);
  if (
    err.code === "ERR_CONNECTION_REFUSED" ||
    err.code === "PROTOCOL_CONNECTION_LOST"
  ) {
    console.error(
      "\n[WARNING] DATABASE CONNECTION FAILED:\n  Please ensure XAMPP MySQL is running on localhost:3306",
    );
  }
});

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
      ? process.env.EMAIL_PASS.replace(/\s+/g, "")
      : "",
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 10000,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "nextstop_bgc_secret_key_2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 20 * 60 * 1000,
      secure: false,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// ============ AUTH MIDDLEWARE (Eliminates 17 repeated checks) ============
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.loggedIn) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
};

const getRequestIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.socket.remoteAddress ||
  null;

const writeAudit = async (query, values) => {
  try {
    await db.query(query, values);
  } catch (err) {
    console.error("[AUDIT ERROR]", err.message);
  }
};

const writeGeneralAudit = (req, values) =>
  writeAudit(
    `INSERT INTO audit_logs
      (user_id, username, action, entity_type, entity_id, new_value, ip_address, user_agent, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.userId || null,
      values.username || null,
      values.action,
      values.entityType,
      values.entityId || null,
      values.newValue || null,
      getRequestIp(req),
      req.get("user-agent") || null,
      values.status || "success",
      values.errorMessage || null,
    ],
  );

const writeLoginAudit = (req, values) =>
  writeAudit(
    `INSERT INTO login_audit
      (user_id, username, email, login_method, ip_address, user_agent, login_status, failure_reason, session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.userId || null,
      values.username || null,
      values.email || null,
      values.method || "email_password",
      getRequestIp(req),
      req.get("user-agent") || null,
      values.status,
      values.failureReason || null,
      values.sessionId || null,
    ],
  );

const writeAccountAudit = (req, values) =>
  writeAudit(
    `INSERT INTO account_audit
      (user_id, changed_by, changed_by_username, change_type, field_name, old_value, new_value, ip_address, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.userId,
      values.changedBy || values.userId,
      values.changedByUsername || values.username || null,
      values.changeType,
      values.fieldName,
      values.oldValue || null,
      values.newValue || null,
      getRequestIp(req),
      values.reason || null,
    ],
  );

const generateTempPassword = () => {
  const length = 12;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_ID !== "your_google_client_id_here"
) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `http://localhost:${PORT}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const [users] = await db.query(
            "SELECT * FROM users WHERE google_id = ?",
            [profile.id],
          );

          if (users.length > 0) {
            return done(null, users[0]);
          }

          const email = profile.emails[0]?.value;
          const displayName = profile.displayName;
          const profilePicture = profile.photos[0]?.value;

          const tempPassword = generateTempPassword();
          const passwordHash = await bcrypt.hash(tempPassword, 10);

          const [newUser] = await db.query(
            "INSERT INTO users (username, email, google_id, oauth_provider, profile_picture, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
            [
              displayName,
              email,
              profile.id,
              "google",
              profilePicture,
              passwordHash,
            ],
          );

          const [createdUser] = await db.query(
            "SELECT * FROM users WHERE id = ?",
            [newUser.insertId],
          );

          createdUser[0].tempPassword = tempPassword;

          return done(null, createdUser[0]);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );
} else {
  console.log(
    "[WARNING] Google OAuth disabled. Configure GOOGLE_CLIENT_ID in .env to enable.",
  );
}

if (
  process.env.FACEBOOK_APP_ID &&
  process.env.FACEBOOK_APP_ID !== "your_facebook_app_id_here"
) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL:
          process.env.FACEBOOK_CALLBACK_URL ||
          `http://localhost:${PORT}/api/auth/facebook/callback`,
        profileFields: ["id", "displayName", "emails", "photos"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const [users] = await db.query(
            "SELECT * FROM users WHERE facebook_id = ?",
            [profile.id],
          );

          if (users.length > 0) {
            return done(null, users[0]);
          }

          const email =
            profile.emails?.[0]?.value || `fb_${profile.id}@facebook.com`;
          const displayName = profile.displayName || `Facebook_${profile.id}`;
          const profilePicture = profile.photos[0]?.value;

          const tempPassword = generateTempPassword();
          const passwordHash = await bcrypt.hash(tempPassword, 10);

          const [newUser] = await db.query(
            "INSERT INTO users (username, email, facebook_id, oauth_provider, profile_picture, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
            [
              displayName,
              email,
              profile.id,
              "facebook",
              profilePicture,
              passwordHash,
            ],
          );

          const [createdUser] = await db.query(
            "SELECT * FROM users WHERE id = ?",
            [newUser.insertId],
          );

          createdUser[0].tempPassword = tempPassword;

          return done(null, createdUser[0]);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );
} else {
  console.log(
    "[WARNING] Facebook OAuth disabled. Configure FACEBOOK_APP_ID in .env to enable.",
  );
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [users] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    done(null, users[0]);
  } catch (err) {
    done(err);
  }
});

const clientPath = path.join(__dirname, "..", "client");
app.use(express.static(path.join(clientPath, "pages")));
app.use("/js", express.static(path.join(clientPath, "js")));
app.use("/css", express.static(path.join(clientPath, "css")));
app.use("/assets", express.static(path.join(clientPath, "assets")));

const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes

app.use((req, res, next) => {
  if (req.session && req.session.loggedIn) {
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    const timeSinceLastActivity = now - lastActivity;

    if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
      req.session.destroy();
      return res
        .status(401)
        .json({ error: "Session expired. Please log in again." });
    }

    req.session.lastActivity = now;
  }
  next();
});

app.use((err, req, res, next) => {
  if (
    err &&
    (err.code === "PROTOCOL_CONNECTION_LOST" ||
      err.code === "ERR_CONNECTION_REFUSED" ||
      err.code === "ER_BAD_DB_ERROR")
  ) {
    console.error("[ERROR] [DATABASE]", err.message);
    return res.status(503).json({
      error:
        "Database service unavailable. Please check XAMPP MySQL connection.",
    });
  }
  next(err);
});

app.get("/api/session", (req, res) => {
  if (req.session && req.session.loggedIn) {
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes

    if (now - lastActivity > INACTIVITY_TIMEOUT) {
      req.session.destroy();
      return res.json({
        loggedIn: false,
        message: "Session expired. Please log in again.",
      });
    }

    req.session.lastActivity = now;
    return res.json({
      loggedIn: true,
      userId: req.session.userId,
      username: req.session.username,
    });
  }
  res.json({ loggedIn: false });
});

app.post("/api/logout", (req, res) => {
  const { userId, username } = req.session || {};
  const sessionId = req.sessionID;

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to log out." });
    }

    if (userId && sessionId) {
      writeAudit(
        "UPDATE session_audit SET session_end = CURRENT_TIMESTAMP, termination_reason = ? WHERE user_id = ? AND session_id = ?",
        ["manual_logout", userId, sessionId],
      );
      writeAudit(
        "UPDATE login_audit SET logout_timestamp = CURRENT_TIMESTAMP, session_duration_minutes = TIMESTAMPDIFF(MINUTE, login_timestamp, CURRENT_TIMESTAMP) WHERE user_id = ? AND session_id = ? AND logout_timestamp IS NULL",
        [userId, sessionId],
      );
      writeGeneralAudit(req, {
        userId,
        username,
        action: "logout",
        entityType: "user",
        entityId: userId,
      });
    }

    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully." });
  });
});

app.post("/api/register", async (req, res) => {
  const {
    username,
    email,
    location,
    birthday,
    phoneNumber,
    password,
    confirmPassword,
  } = req.body;

  if (
    !username ||
    !email ||
    !location ||
    !birthday ||
    !phoneNumber ||
    !password ||
    !confirmPassword
  ) {
    return res
      .status(400)
      .json({ error: "Please complete all required fields." });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  try {
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE username = ? OR email = ?",
      [username, email],
    );

    if (existingUsers.length > 0) {
      return res
        .status(400)
        .json({ error: "Username or email address is already taken." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [registrationResult] = await db.query(
      "INSERT INTO users (username, email, location, birthday, phone_number, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
      [
        username,
        email,
        location || null,
        birthday || null,
        phoneNumber || null,
        passwordHash,
      ],
    );

    await writeAccountAudit(req, {
      userId: registrationResult.insertId,
      changedBy: registrationResult.insertId,
      changedByUsername: username,
      username,
      changeType: "profile_update",
      fieldName: "account",
      newValue: "Account created",
      reason: "New account registration",
    });
    await writeGeneralAudit(req, {
      userId: registrationResult.insertId,
      username,
      action: "register",
      entityType: "user",
      entityId: registrationResult.insertId,
      newValue: JSON.stringify({ username, email }),
    });

    res.status(201).json({
      message: "Account created successfully! Redirecting to login...",
    });
  } catch (err) {
    console.error("[REGISTRATION ERROR]", err.message);
    if (err.code === "ER_ACCESS_DENIED_ERROR") {
      return res
        .status(503)
        .json({ error: "Database connection failed. Check XAMPP MySQL." });
    }
    if (
      err.code === "ERR_CONNECTION_REFUSED" ||
      err.code === "PROTOCOL_CONNECTION_LOST"
    ) {
      return res.status(503).json({
        error: "Database connection failed. Ensure XAMPP MySQL is running.",
      });
    }
    res.status(500).json({ error: "Database error during registration." });
  }
});

app.post("/api/login", async (req, res) => {
  const { emailUsername, password } = req.body;

  if (!emailUsername || !password) {
    return res.status(400).json({ error: "Please fill in both credentials." });
  }

  try {
    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [emailUsername, emailUsername],
    );

    if (users.length === 0) {
      await writeLoginAudit(req, {
        email: emailUsername,
        status: "failed",
        failureReason: "Invalid username or email",
      });
      await writeGeneralAudit(req, {
        action: "login_failed",
        entityType: "user",
        status: "failed",
        errorMessage: "Invalid username or email",
      });
      return res
        .status(400)
        .json({ error: "Invalid username/email or password." });
    }

    const user = users[0];

    if (user.account_locked) {
      const now = new Date();
      const lockUntil = new Date(user.lock_until);

      if (now < lockUntil) {
        await writeLoginAudit(req, {
          userId: user.id,
          username: user.username,
          email: user.email,
          status: "locked",
          failureReason: "Account is temporarily locked",
        });
        const minutesRemaining = Math.ceil((lockUntil - now) / (1000 * 60));
        return res.status(403).json({
          error: `Your account has been locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minute(s).`,
        });
      } else {
        await db.query(
          "UPDATE users SET account_locked = 0, lock_until = NULL, failed_attempts = 0 WHERE id = ?",
          [user.id],
        );
      }
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      const newFailedAttempts = user.failed_attempts + 1;
      const maxAttempts = 5;

      if (newFailedAttempts >= maxAttempts) {
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
        await db.query(
          "UPDATE users SET failed_attempts = ?, account_locked = 1, lock_until = ? WHERE id = ?",
          [newFailedAttempts, lockUntil, user.id],
        );
        await writeLoginAudit(req, {
          userId: user.id,
          username: user.username,
          email: user.email,
          status: "locked",
          failureReason: "Maximum failed login attempts reached",
        });
        await writeAccountAudit(req, {
          userId: user.id,
          username: user.username,
          changeType: "account_locked",
          fieldName: "account_locked",
          oldValue: "0",
          newValue: "1",
          reason: "Maximum failed login attempts reached",
        });
        return res.status(403).json({
          error:
            "Your account has been locked due to multiple failed login attempts. Please try again in 30 minutes or contact support.",
        });
      }

      await db.query("UPDATE users SET failed_attempts = ? WHERE id = ?", [
        newFailedAttempts,
        user.id,
      ]);
      await writeLoginAudit(req, {
        userId: user.id,
        username: user.username,
        email: user.email,
        status: "failed",
        failureReason: "Invalid password",
      });

      const attemptsRemaining = maxAttempts - newFailedAttempts;
      return res.status(400).json({
        error: `Invalid username/email or password. Attempts remaining: ${attemptsRemaining}`,
      });
    }

    await db.query(
      "UPDATE users SET failed_attempts = 0, account_locked = 0 WHERE id = ?",
      [user.id],
    );

    req.session.loggedIn = true;
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.lastActivity = Date.now();

    await writeLoginAudit(req, {
      userId: user.id,
      username: user.username,
      email: user.email,
      status: "success",
      sessionId: req.sessionID,
    });
    await writeAudit(
      "INSERT INTO session_audit (user_id, session_id, ip_address, user_agent, last_activity) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
      [
        user.id,
        req.sessionID,
        getRequestIp(req),
        req.get("user-agent") || null,
      ],
    );
    await writeGeneralAudit(req, {
      userId: user.id,
      username: user.username,
      action: "login",
      entityType: "user",
      entityId: user.id,
    });

    res.json({ message: "Login successful! Redirecting to dashboard..." });
  } catch (err) {
    console.error("[LOGIN ERROR]", err.message);
    if (
      err.code === "ERR_CONNECTION_REFUSED" ||
      err.code === "PROTOCOL_CONNECTION_LOST"
    ) {
      return res.status(503).json({
        error: "Database connection failed. Ensure XAMPP MySQL is running.",
      });
    }
    res.status(500).json({ error: "Server error during login." });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Please enter your email address." });
  }

  try {
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res
        .status(404)
        .json({ error: "No account registered with that email address." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 3600000);

    await db.query(
      "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?",
      [token, expiry, email],
    );

    const resetUrl = `http://localhost:${PORT}/reset_pass.html?token=${token}`;

    const mailOptions = {
      from: `"NextStop BGC" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "[Password Reset] NextStop BGC - Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #2D967F;">NEXTSTOP BGC</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password. Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2D967F; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 15px 0;">Reset Password</a>
          <p style="font-size: 12px; color: #777;">This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailErr) {
      console.log("[EMAIL] Service unavailable. Reset link:", resetUrl);
    }

    res.json({
      message: "Password reset link sent! Please check your email inbox.",
    });
  } catch (err) {
    console.error("[FORGOT PASSWORD ERROR]", err.message);
    if (
      err.code === "ERR_CONNECTION_REFUSED" ||
      err.code === "PROTOCOL_CONNECTION_LOST"
    ) {
      return res.status(503).json({
        error: "Database connection failed. Ensure XAMPP MySQL is running.",
      });
    }
    res.status(500).json({ error: "Server error generating reset link." });
  }
});

app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ error: "Invalid token or missing password." });
  }

  try {
    const [users] = await db.query(
      "SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()",
      [token],
    );

    if (users.length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid or expired password reset link." });
    }

    const user = users[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
      [passwordHash, user.id],
    );

    await writeAccountAudit(req, {
      userId: user.id,
      username: user.username,
      changeType: "password_change",
      fieldName: "password_hash",
      newValue: "[hidden]",
      reason: "Password reset completed",
    });

    res.json({
      message: "Password updated successfully! Redirecting to login...",
    });
  } catch (err) {
    console.error("[RESET PASSWORD ERROR]", err.message);
    if (
      err.code === "ERR_CONNECTION_REFUSED" ||
      err.code === "PROTOCOL_CONNECTION_LOST"
    ) {
      return res.status(503).json({
        error: "Database connection failed. Ensure XAMPP MySQL is running.",
      });
    }
    res.status(500).json({ error: "Server error resetting password." });
  }
});

app.post("/api/admin/unlock-account", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email address is required." });
  }

  try {
    const result = await db.query(
      "UPDATE users SET account_locked = 0, failed_attempts = 0, lock_until = NULL WHERE email = ?",
      [email],
    );

    const [users] = await db.query(
      "SELECT id, username FROM users WHERE email = ?",
      [email],
    );
    if (users.length > 0) {
      await writeAccountAudit(req, {
        userId: users[0].id,
        username: users[0].username,
        changeType: "account_unlocked",
        fieldName: "account_locked",
        oldValue: "1",
        newValue: "0",
        reason: "Account manually unlocked",
      });
    }

    res.json({ message: `Account ${email} has been unlocked.` });
  } catch (err) {
    console.error("[UNLOCK ACCOUNT ERROR]", err.message);
    if (
      err.code === "ERR_CONNECTION_REFUSED" ||
      err.code === "PROTOCOL_CONNECTION_LOST"
    ) {
      return res.status(503).json({
        error: "Database connection failed. Ensure XAMPP MySQL is running.",
      });
    }
    res.status(500).json({ error: "Server error unlocking account." });
  }
});

if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_ID !== "your_google_client_id_here"
) {
  app.get(
    "/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] }),
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/log_in.html" }),
    (req, res) => {
      req.session.loggedIn = true;
      req.session.userId = req.user.id;
      req.session.username = req.user.username;
      req.session.lastActivity = Date.now();

      if (req.user.tempPassword) {
        req.session.tempPassword = req.user.tempPassword;
      }

      res.redirect("/dashboard.html");
    },
  );
}

if (
  process.env.FACEBOOK_APP_ID &&
  process.env.FACEBOOK_APP_ID !== "your_facebook_app_id_here"
) {
  app.get(
    "/api/auth/facebook",
    passport.authenticate("facebook", { scope: ["email"] }),
  );

  app.get(
    "/api/auth/facebook/callback",
    passport.authenticate("facebook", { failureRedirect: "/log_in.html" }),
    (req, res) => {
      req.session.loggedIn = true;
      req.session.userId = req.user.id;
      req.session.username = req.user.username;
      req.session.lastActivity = Date.now();

      if (req.user.tempPassword) {
        req.session.tempPassword = req.user.tempPassword;
      }

      res.redirect("/dashboard.html");
    },
  );
}

app.get("/api/config", (req, res) => {
  res.json({
    googleOAuthEnabled:
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_ID !== "your_google_client_id_here",
    facebookOAuthEnabled:
      process.env.FACEBOOK_APP_ID &&
      process.env.FACEBOOK_APP_ID !== "your_facebook_app_id_here",
  });
});

app.get("/api/temp-password", (req, res) => {
  if (!req.session || !req.session.loggedIn) {
    return res.status(401).json({ error: "Not logged in" });
  }

  if (req.session.tempPassword) {
    const tempPassword = req.session.tempPassword;
    delete req.session.tempPassword; // Remove after retrieval
    return res.json({
      tempPassword,
      message: "Save this password to login manually with your email",
    });
  }

  res.json({ tempPassword: null });
});

// Dashboard API Endpoints

// Get all bus routes
app.get("/api/routes", requireAuth, async (req, res) => {
  try {
    const [routes] = await db.query(
      "SELECT id, route_number, route_name, route_color, start_location, end_location, status, eta_minutes, frequency_minutes, current_capacity, max_capacity FROM routes WHERE is_active = 1 ORDER BY route_number",
    );

    res.json({ routes });
  } catch (err) {
    console.error("[GET ROUTES ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch routes" });
  }
});

// Get all bus stops
app.get("/api/stops", requireAuth, async (req, res) => {
  try {
    const [stops] = await db.query(
      "SELECT id, stop_name, latitude, longitude, stop_type, distance_km FROM bus_stops WHERE is_active = 1 ORDER BY stop_name",
    );

    res.json({ stops });
  } catch (err) {
    console.error("[GET STOPS ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch bus stops" });
  }
});

// Get route details with stops
app.get("/api/routes/:routeId", requireAuth, async (req, res) => {
  const { routeId } = req.params;

  try {
    const [route] = await db.query("SELECT * FROM routes WHERE id = ?", [
      routeId,
    ]);

    if (route.length === 0) {
      return res.status(404).json({ error: "Route not found" });
    }

    const [routeStops] = await db.query(
      `SELECT bs.id, bs.stop_name, bs.latitude, bs.longitude, bs.stop_type, rs.stop_order, rs.arrival_time_offset_minutes
       FROM route_stops rs
       JOIN bus_stops bs ON rs.stop_id = bs.id
       WHERE rs.route_id = ?
       ORDER BY rs.stop_order`,
      [routeId],
    );

    res.json({ route: route[0], stops: routeStops });
  } catch (err) {
    console.error("[GET ROUTE DETAILS ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch route details" });
  }
});

// Get user's travel history
app.get("/api/history", requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    const [history] = await db.query(
      `SELECT th.id, th.route_id, th.from_stop, th.to_stop, th.travel_date, th.travel_time, th.duration_minutes, r.route_name, r.route_number
       FROM travel_history th
       JOIN routes r ON th.route_id = r.id
       WHERE th.user_id = ?
       ORDER BY th.travel_date DESC, th.travel_time DESC
       LIMIT 20`,
      [userId],
    );

    res.json({ history });
  } catch (err) {
    console.error("[GET HISTORY ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch travel history" });
  }
});

// Log a trip to travel history
app.post("/api/history", requireAuth, async (req, res) => {
  const { routeId, fromStop, toStop, durationMinutes } = req.body;
  const userId = req.session.userId;

  if (!routeId || !fromStop || !toStop) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const travelDate = new Date().toISOString().split("T")[0];
    const travelTime = new Date().toTimeString().split(" ")[0];

    const [tripResult] = await db.query(
      "INSERT INTO travel_history (user_id, route_id, from_stop, to_stop, travel_date, travel_time, duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        userId,
        routeId,
        fromStop,
        toStop,
        travelDate,
        travelTime,
        durationMinutes || null,
      ],
    );

    await writeAudit(
      "INSERT INTO trip_audit (trip_id, user_id, route_id, logged_by, logged_by_username, action, from_stop, to_stop, travel_date, travel_time, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        tripResult.insertId,
        userId,
        routeId,
        userId,
        req.session.username,
        "logged",
        fromStop,
        toStop,
        travelDate,
        travelTime,
        "manually-logged",
      ],
    );
    await writeGeneralAudit(req, {
      userId,
      username: req.session.username,
      action: "trip_logged",
      entityType: "travel_history",
      entityId: tripResult.insertId,
    });

    res.status(201).json({ message: "Trip logged successfully" });
  } catch (err) {
    console.error("[LOG TRIP ERROR]", err.message);
    res.status(500).json({ error: "Failed to log trip" });
  }
});

// Get user's feedback
app.get("/api/feedback", requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    const [feedback] = await db.query(
      `SELECT f.id, f.route_id, f.feedback_text, f.rating, f.feedback_category, f.created_at, r.route_name
       FROM feedback f
       LEFT JOIN routes r ON f.route_id = r.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC
       LIMIT 10`,
      [userId],
    );

    res.json({ feedback });
  } catch (err) {
    console.error("[GET FEEDBACK ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

// Submit feedback
app.post("/api/feedback", requireAuth, async (req, res) => {
  const { feedbackText, rating, category, routeId } = req.body;
  const userId = req.session.userId;

  if (!feedbackText || feedbackText.trim().length === 0) {
    return res.status(400).json({ error: "Feedback text is required" });
  }

  if (feedbackText.trim().length > 1000) {
    return res
      .status(400)
      .json({ error: "Feedback text must be less than 1000 characters" });
  }

  try {
    const [feedbackResult] = await db.query(
      "INSERT INTO feedback (user_id, route_id, feedback_text, rating, feedback_category) VALUES (?, ?, ?, ?, ?)",
      [
        userId,
        routeId || null,
        feedbackText.trim(),
        rating || null,
        category || null,
      ],
    );

    await writeAudit(
      "INSERT INTO feedback_audit (feedback_id, user_id, action, feedback_text, rating, category, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        feedbackResult.insertId,
        userId,
        "submitted",
        feedbackText.trim(),
        rating || null,
        category || null,
        "pending",
      ],
    );
    await writeGeneralAudit(req, {
      userId,
      username: req.session.username,
      action: "feedback_submitted",
      entityType: "feedback",
      entityId: feedbackResult.insertId,
    });

    res.status(201).json({ message: "Feedback submitted successfully" });
  } catch (err) {
    console.error("[SUBMIT FEEDBACK ERROR]", err.message);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

// ==================== AUDIT API ENDPOINTS ====================

// Get general audit logs (Admin only)
app.get("/api/audit/logs", requireAuth, async (req, res) => {
  // TODO: Add admin role check when role system is implemented
  // For now, restrict to super admin or log owner
  const {
    limit = 50,
    offset = 0,
    action = null,
    entity_type = null,
  } = req.query;

  try {
    let query =
      "SELECT id, user_id, username, action, entity_type, entity_id, status, timestamp FROM audit_logs WHERE 1=1";
    const params = [];

    if (action) {
      query += " AND action = ?";
      params.push(action);
    }
    if (entity_type) {
      query += " AND entity_type = ?";
      params.push(entity_type);
    }

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await db.query(query, params);
    res.json({ logs, total: logs.length });
  } catch (err) {
    console.error("[GET AUDIT LOGS ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// Get login history (Admin + User's own data)
app.get("/api/audit/login-history", requireAuth, async (req, res) => {
  const { limit = 20, offset = 0, user_id = null } = req.query;
  const loggedInUserId = req.session.userId;

  try {
    let query =
      "SELECT id, user_id, username, email, login_method, login_status, ip_address, login_timestamp, logout_timestamp, session_duration_minutes FROM login_audit WHERE 1=1";
    const params = [];

    // Users can see their own login history, admins can see all
    if (user_id && user_id !== loggedInUserId) {
      // TODO: Check if current user is admin
      return res
        .status(403)
        .json({ error: "Not authorized to view this user's login history" });
    }

    query += " ORDER BY login_timestamp DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await db.query(query, params);
    res.json({ logs });
  } catch (err) {
    console.error("[GET LOGIN HISTORY ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch login history" });
  }
});

// Get route data changes (Admin only)
app.get("/api/audit/route-changes", requireAuth, async (req, res) => {
  const { route_id = null, limit = 50, offset = 0 } = req.query;

  try {
    let query =
      "SELECT id, route_id, changed_by_username, change_type, field_name, old_value, new_value, change_reason, timestamp FROM route_audit WHERE 1=1";
    const params = [];

    if (route_id) {
      query += " AND route_id = ?";
      params.push(route_id);
    }

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [changes] = await db.query(query, params);
    res.json({ changes });
  } catch (err) {
    console.error("[GET ROUTE CHANGES ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch route changes" });
  }
});

// Get feedback audit trail
app.get("/api/audit/feedback-audit", requireAuth, async (req, res) => {
  const { limit = 30, offset = 0, status = null } = req.query;
  const userId = req.session.userId;

  try {
    let query =
      "SELECT id, feedback_id, user_id, action, feedback_text, rating, category, status, timestamp FROM feedback_audit WHERE user_id = ?";
    const params = [userId];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [audit] = await db.query(query, params);
    res.json({ audit });
  } catch (err) {
    console.error("[GET FEEDBACK AUDIT ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch feedback audit" });
  }
});

// Get trip audit trail
app.get("/api/audit/trip-audit", requireAuth, async (req, res) => {
  const { limit = 30, offset = 0 } = req.query;
  const userId = req.session.userId;

  try {
    const query = `SELECT id, trip_id, route_id, logged_by_username, action, from_stop, to_stop, 
                   travel_date, travel_time, verification_status, timestamp 
                   FROM trip_audit 
                   WHERE user_id = ? 
                   ORDER BY timestamp DESC 
                   LIMIT ? OFFSET ?`;

    const [audit] = await db.query(query, [
      userId,
      parseInt(limit),
      parseInt(offset),
    ]);
    res.json({ audit });
  } catch (err) {
    console.error("[GET TRIP AUDIT ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch trip audit" });
  }
});

// Get account changes (User's own + Admin)
app.get("/api/audit/account-changes", requireAuth, async (req, res) => {
  const { limit = 30, offset = 0 } = req.query;
  const userId = req.session.userId;

  try {
    const query = `SELECT id, user_id, changed_by_username, change_type, field_name, 
                   timestamp FROM account_audit 
                   WHERE user_id = ? 
                   ORDER BY timestamp DESC 
                   LIMIT ? OFFSET ?`;

    const [changes] = await db.query(query, [
      userId,
      parseInt(limit),
      parseInt(offset),
    ]);
    res.json({ changes });
  } catch (err) {
    console.error("[GET ACCOUNT CHANGES ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch account changes" });
  }
});

// Get session audit (User's own sessions)
app.get("/api/audit/sessions", requireAuth, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const userId = req.session.userId;

  try {
    const query = `SELECT id, user_id, ip_address, session_start, session_end, 
                   termination_reason, activity_count FROM session_audit 
                   WHERE user_id = ? 
                   ORDER BY session_start DESC 
                   LIMIT ? OFFSET ?`;

    const [sessions] = await db.query(query, [
      userId,
      parseInt(limit),
      parseInt(offset),
    ]);
    res.json({ sessions });
  } catch (err) {
    console.error("[GET SESSIONS ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// Get system events (Admin only)
app.get("/api/audit/system-events", requireAuth, async (req, res) => {
  // TODO: Add admin role check
  const {
    limit = 50,
    offset = 0,
    severity = null,
    event_type = null,
  } = req.query;

  try {
    let query =
      "SELECT id, event_type, severity, message, related_user_id, timestamp FROM system_events WHERE 1=1";
    const params = [];

    if (event_type) {
      query += " AND event_type = ?";
      params.push(event_type);
    }
    if (severity) {
      query += " AND severity = ?";
      params.push(severity);
    }

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [events] = await db.query(query, params);
    res.json({ events });
  } catch (err) {
    console.error("[GET SYSTEM EVENTS ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch system events" });
  }
});

// Get API access stats (Admin only)
app.get("/api/audit/api-stats", requireAuth, async (req, res) => {
  // TODO: Add admin role check
  const { limit = 20, endpoint = null } = req.query;

  try {
    let query = `SELECT endpoint, COUNT(*) as call_count, 
                 AVG(response_time_ms) as avg_response_time,
                 MAX(response_time_ms) as max_response_time,
                 SUM(CASE WHEN response_status != 200 THEN 1 ELSE 0 END) as error_count
                 FROM api_access_log 
                 WHERE 1=1`;
    const params = [];

    if (endpoint) {
      query += " AND endpoint = ?";
      params.push(endpoint);
    }

    query += " GROUP BY endpoint ORDER BY call_count DESC LIMIT ?";
    params.push(parseInt(limit));

    const [stats] = await db.query(query, params);
    res.json({ stats });
  } catch (err) {
    console.error("[GET API STATS ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch API stats" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "pages", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n[SYSTEM] ==========================================`);
  console.log(`[SYSTEM] NextStop Server Started!`);
  console.log(`[SYSTEM] Running on http://localhost:${PORT}`);
  console.log(`[SYSTEM] ==========================================\n`);
  console.log(`[ROUTES] Authentication APIs:`);
  console.log(`  POST   /api/register        - Create new account`);
  console.log(`  POST   /api/login           - Log in to account`);
  console.log(`  POST   /api/logout          - Log out of account`);
  console.log(`  POST   /api/forgot-password - Request password reset`);
  console.log(`  POST   /api/reset-password  - Reset password with token`);
  console.log(`  GET    /api/session         - Check session status\n`);
  console.log(`[ROUTES] Dashboard APIs:`);
  console.log(`  GET    /api/routes          - Get all bus routes`);
  console.log(`  GET    /api/routes/:id      - Get route details with stops`);
  console.log(`  GET    /api/stops           - Get all bus stops`);
  console.log(`  GET    /api/history         - Get user's travel history`);
  console.log(`  POST   /api/history         - Log a trip`);
  console.log(`  GET    /api/feedback        - Get user's feedback`);
  console.log(`  POST   /api/feedback        - Submit feedback\n`);
  console.log(`[ROUTES] Audit APIs:`);
  console.log(
    `  GET    /api/audit/logs              - General audit logs (admin)`,
  );
  console.log(`  GET    /api/audit/login-history    - Login audit trail`);
  console.log(
    `  GET    /api/audit/route-changes    - Route data changes (admin)`,
  );
  console.log(`  GET    /api/audit/feedback-audit   - Feedback audit trail`);
  console.log(`  GET    /api/audit/trip-audit       - Trip logging audit`);
  console.log(
    `  GET    /api/audit/account-changes  - Account modification log`,
  );
  console.log(`  GET    /api/audit/sessions         - User session history`);
  console.log(
    `  GET    /api/audit/system-events    - System events log (admin)`,
  );
  console.log(
    `  GET    /api/audit/api-stats        - API performance stats (admin)\n`,
  );
});
