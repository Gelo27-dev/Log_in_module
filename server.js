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
const db = require("./db");

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

app.use(express.static(__dirname));

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
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to log out." });
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

    await db.query(
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
      return res
        .status(400)
        .json({ error: "Invalid username/email or password." });
    }

    const user = users[0];

    if (user.account_locked) {
      const now = new Date();
      const lockUntil = new Date(user.lock_until);

      if (now < lockUntil) {
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
        return res.status(403).json({
          error:
            "Your account has been locked due to multiple failed login attempts. Please try again in 30 minutes or contact support.",
        });
      }

      await db.query("UPDATE users SET failed_attempts = ? WHERE id = ?", [
        newFailedAttempts,
        user.id,
      ]);

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

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n[SYSTEM] ==========================================`);
  console.log(`[SYSTEM] NextStop Server Started!`);
  console.log(`[SYSTEM] Running on http://localhost:${PORT}`);
  console.log(`[SYSTEM] ==========================================\n`);
  console.log(`[ROUTES] Available API endpoints:`);
  console.log(`  POST   /api/register        - Create new account`);
  console.log(`  POST   /api/login           - Log in to account`);
  console.log(`  POST   /api/logout          - Log out of account`);
  console.log(`  POST   /api/forgot-password - Request password reset`);
  console.log(`  POST   /api/reset-password  - Reset password with token`);
  console.log(`  GET    /api/session         - Check session status\n`);
});
