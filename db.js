require("dotenv").config();
const mysql = require("mysql2");

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

db.getConnection((err, connection) => {
  if (err) {
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      console.error(
        "[DATABASE] Connection was closed (XAMPP server may not be running).",
      );
    }
    if (err.code === "ERR_CONNECTION_REFUSED") {
      console.error(
        "[DATABASE] Connection was refused. Ensure XAMPP MySQL is running on localhost:3306",
      );
    }
    if (err.code === "ER_BAD_DB_ERROR") {
      console.error(
        "[DATABASE] Database 'nextstop_db' does not exist. Please run database.sql first.",
      );
    }
    console.error("[DATABASE] Error:", err.message);
  } else {
    console.log("[DATABASE] [SUCCESS] Successfully connected to MySQL (XAMPP)");
    connection.release();
  }
});

module.exports = db.promise();
