require("dotenv").config();
const mysql = require("mysql2");

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "nextstop_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("[DATABASE] Connection failed:", err.message);
  } else {
    console.log("[DATABASE] Successfully connected to MySQL (XAMPP)");
    connection.release();
  }
});

module.exports = db.promise();
