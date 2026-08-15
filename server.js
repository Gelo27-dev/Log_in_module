require('dotenv').config();
const express = require('express');
const session = require('express-session'); // 👈 Added express-session
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt'); 
const nodemailer = require('nodemailer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;


const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '' 
  },
  tls: {
    rejectUnauthorized: false 
  },
  connectionTimeout: 10000 
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'nextstop_bgc_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static(__dirname));


app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Please enter your email address.' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'No account registered with that email address.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // Token expires in 1 hour

    // Save reset token to database
    await db.query(
      'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
      [token, expiry, email]
    );

    const resetUrl = `http://localhost:${PORT}/reset_pass.html?token=${token}`;

    
    const mailOptions = {
      from: `"NextStop BGC" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔑 NextStop BGC - Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #2D967F;">NEXTSTOP BGC</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password. Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2D967F; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 15px 0;">Reset Password</a>
          <p style="font-size: 12px; color: #777;">This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
        </div>
      `
    };

    
    await transporter.sendMail(mailOptions);

    res.json({ message: 'Password reset link sent! Please check your email inbox.' });

  } catch (err) {
    console.error('Forgot Password Email Error:', err);
    res.status(500).json({ error: 'Failed to send password reset email. Please try again later.' });
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 💡 Configure Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'nextstop_bgc_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, 
    maxAge: 24 * 60 * 60 * 1000 
  }
}));


app.use(express.static(__dirname));




app.get('/api/session', (req, res) => {
  if (req.session && req.session.loggedIn) {
    return res.json({
      loggedIn: true,
      username: req.session.username
    });
  }
  res.json({ loggedIn: false });
});


app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to log out.' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});


app.post('/api/register', async (req, res) => {
  const { username, email, location, password, confirmPassword } = req.body;

  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Please complete all required fields.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  try {
    const [existingUsers] = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Username or email address is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
      'INSERT INTO users (username, email, location, password_hash) VALUES (?, ?, ?, ?)',
      [username, email, location || null, passwordHash]
    );

    res.status(201).json({ message: 'Account created successfully! Redirecting to login...' });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Database error during registration.' });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  const { emailUsername, password } = req.body;

  if (!emailUsername || !password) {
    return res.status(400).json({ error: 'Please fill in both credentials.' });
  }

  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [emailUsername, emailUsername]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid username/email or password.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username/email or password.' });
    }

  
    req.session.loggedIn = true;
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ message: 'Login successful! Redirecting to dashboard...' });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});


app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Please enter your email address.' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'No account registered with that email address.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); 

    await db.query(
      'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
      [token, expiry, email]
    );

    const resetUrl = `http://localhost:${PORT}/reset_pass.html?token=${token}`;

    console.log('\n==================================================');
    console.log(`🔑 PASSWORD RESET LINK FOR: ${email}`);
    console.log(`👉 ${resetUrl}`);
    console.log('==================================================\n');

    res.json({ message: 'Reset link generated! Check your VS Code terminal output.' });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ error: 'Server error generating reset link.' });
  }
});


app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Invalid token or missing password.' });
  }

  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired password reset link.' });
    }

    const user = users[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      [passwordHash, user.id]
    );

    res.json({ message: 'Password updated successfully! Redirecting to login...' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ error: 'Server error resetting password.' });
  }
});


app.get('/api/auth/google', (req, res) => {
  res.redirect('https://accounts.google.com');
});

app.get('/api/auth/facebook', (req, res) => {
  res.redirect('https://www.facebook.com');
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


app.listen(PORT, () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
});