#!/usr/bin/env node
require("dotenv").config();
const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

console.log("\n[SYSTEM] ============================================");
console.log("[SYSTEM] NextStop Database Setup");
console.log("[SYSTEM] ============================================\n");

const connection = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
});

connection.connect((err) => {
  if (err) {
    console.error("[ERROR] Failed to connect to MySQL:", err.message);
    if (err.code === "ERR_CONNECTION_REFUSED") {
      console.error(
        "[INFO] Make sure XAMPP MySQL is running on localhost:3306",
      );
    }
    process.exit(1);
  }

  console.log("[SUCCESS] Connected to MySQL\n");

  const sqlFilePath = path.join(__dirname, "database.sql");
  let sqlContent;

  try {
    sqlContent = fs.readFileSync(sqlFilePath, "utf8");
  } catch (err) {
    console.error("[ERROR] Could not read database.sql:", err.message);
    connection.end();
    process.exit(1);
  }

  console.log("[STEP 1] Creating database...");

  const queries = sqlContent
    .split(";")
    .map((q) => q.trim())
    .filter((q) => q.length > 0);

  let completed = 0;

  queries.forEach((query, index) => {
    connection.query(query, (err) => {
      if (err) {
        console.error(`[ERROR] Query ${index + 1} failed:`, err.message);
        connection.end();
        process.exit(1);
      }

      completed++;
      console.log(
        `[STEP ${completed + 1}] Executed query ${completed}/${queries.length}`,
      );

      if (completed === queries.length) {
        console.log("\n[SUCCESS] Database setup completed!\n");
        console.log("[INFO] Verifying database structure...");

        connection.query("SHOW TABLES FROM nextstop_db", (err, results) => {
          if (err) {
            console.error("[ERROR] Could not verify tables:", err.message);
            connection.end();
            process.exit(1);
          }

          console.log("[SUCCESS] Tables created:");
          results.forEach((row) => {
            const tableName = Object.values(row)[0];
            console.log(`   - ${tableName}`);
          });

          console.log("\n[SUCCESS] NextStop database is ready!\n");
          connection.end();
          process.exit(0);
        });
      }
    });
  });
});

connection.on("error", (err) => {
  console.error("[ERROR] Connection error:", err.message);
  process.exit(1);
});
