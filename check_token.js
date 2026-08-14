const db = require('./db');
(async () => {
  try {
    const [users] = await db.query('SELECT id, username, email, reset_token FROM users WHERE email = ?', ['testfinal2026@test.com']);
    console.log('User Data:', JSON.stringify(users[0], null, 2));
    process.exit(0);
  } catch(err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
