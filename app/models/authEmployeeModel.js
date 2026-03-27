const db = require("./db.js");

class EmployeeAuthModel {

  //  CREATE AUTH RECORD
  static create(auth,connectionOrCallback, maybeCallback) {
    let connection = db; // default to global db
    let callback;

    // Determine if connection is passed
    if (typeof maybeCallback === "function") {
      connection = connectionOrCallback;
      callback = maybeCallback;
    } else {
      callback = connectionOrCallback;
    }

    console.log("creating auth record with details: ", auth);
    if (!auth.employee_id || !auth.username || !auth.password_hash) {
      return callback(new Error("Missing required fields"), null);
    }

    const sql = `
      INSERT INTO employee_auth 
      (employee_id, user_name, password_hash)
      VALUES (?, ?, ?)
    `;
    console.log("SQL Query: ", sql);
    connection.query(sql, [
      auth.employee_id,
      auth.username,
      auth.password_hash
    ], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  //  FIND BY USERNAME (LOGIN ENTRY POINT)
  static findByUsername(username, callback) {
    const sql = "SELECT * FROM employee_auth WHERE user_name = ?";

    db.query(sql, [username], (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows[0] || null);
    });
  }

  //  FIND BY EMPLOYEE ID
  static findByEmployeeId(employeeId, callback) {
    const sql = "SELECT * FROM employee_auth WHERE employee_id = ?";

    db.query(sql, [employeeId], (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows[0] || null);
    });
  }

  //  UPDATE PASSWORD
  static updatePassword(employeeId, passwordHash, callback) {
    const sql = `
      UPDATE employee_auth 
      SET password_hash = ? 
      WHERE employee_id = ?
    `;

    db.query(sql, [passwordHash, employeeId], (err, result) => {
      if (err) return callback(err, null);

      if (result.affectedRows === 0) {
        return callback(new Error("Employee not found"), null);
      }

      callback(null, result);
    });
  }

  //  RECORD FAILED LOGIN ATTEMPT
  static incrementFailedAttempts(employeeId, callback) {
    const sql = `
      UPDATE employee_auth 
      SET failed_attempts = failed_attempts + 1
      WHERE employee_id = ?
    `;

    db.query(sql, [employeeId], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  //  RESET FAILED ATTEMPTS (AFTER SUCCESSFUL LOGIN)
  static resetFailedAttempts(employeeId, callback) {
    const sql = `
      UPDATE employee_auth 
      SET failed_attempts = 0
      WHERE employee_id = ?
    `;

    db.query(sql, [employeeId], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  //  LOCK ACCOUNT
  static lockAccount(employeeId, callback) {
    const sql = `
      UPDATE employee_auth 
      SET is_locked = TRUE
      WHERE employee_id = ?
    `;

    db.query(sql, [employeeId], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  //  UNLOCK ACCOUNT (ADMIN ACTION)
  static unlockAccount(employeeId, callback) {
    const sql = `
      UPDATE employee_auth 
      SET is_locked = FALSE, failed_attempts = 0
      WHERE employee_id = ?
    `;

    db.query(sql, [employeeId], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  //  UPDATE LAST LOGIN
  static updateLastLogin(employeeId, callback) {
    const sql = `
      UPDATE employee_auth 
      SET last_login = CURRENT_TIMESTAMP
      WHERE employee_id = ?
    `;

    db.query(sql, [employeeId], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  //  CHECK IF ACCOUNT IS LOCKED
  static isLocked(employeeId, callback) {
    const sql = `
      SELECT is_locked, failed_attempts 
      FROM employee_auth 
      WHERE employee_id = ?
    `;

    db.query(sql, [employeeId], (err, rows) => {
      if (err) return callback(err, null);

      if (!rows[0]) {
        return callback(new Error("Auth record not found"), null);
      }

      callback(null, rows[0]);
    });
  }

  //  DELETE AUTH (RARE — ADMIN CLEANUP ONLY)
  static delete(employeeId, callback) {
    const sql = "DELETE FROM employee_auth WHERE employee_id = ?";

    db.query(sql, [employeeId], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

}

module.exports = EmployeeAuthModel;