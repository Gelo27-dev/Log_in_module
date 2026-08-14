require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt'); 
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files (HTML, CSS, JS)
app.use(express.static(__dirname));


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

    // Save token to MySQL
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

    // Update password and clear reset token
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
  // Redirects the browser directly to Google
  res.redirect('https://accounts.google.com');
});

app.get('/api/auth/facebook', (req, res) => {
  // Redirects the browser directly to Facebook
  res.redirect('https://www.facebook.com');
});

// Serve root index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
});

document.addEventListener('DOMContentLoaded', () => {
  const googleBtn = document.getElementById('btn-google');
  const facebookBtn = document.getElementById('btn-facebook');

  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      window.location.href = '/api/auth/google';
    });
  }

  if (facebookBtn) {
    facebookBtn.addEventListener('click', () => {
      window.location.href = '/api/auth/facebook';
    });
  }
});