const db = require('./db.js');

class EmployeeRoleModel {

  /**
   * Assign role (supports transaction)
   */
  static assignRole(employeeId, roleId, assignedBy = null, connectionOrCallback, maybeCallback) {
    let connection = db;
    let callback;

    // Detect if connection is passed
    if (typeof maybeCallback === "function") {
      connection = connectionOrCallback;
      callback = maybeCallback;
    } else {
      callback = connectionOrCallback;
    }

    if (!callback) {
      throw new Error("Callback is required");
    }

    console.log("Assigning role:", employeeId, roleId);

    const sql = `
      INSERT INTO employee_roles (employee_id, role_id, assigned_by, is_active)
      VALUES (?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE is_active = TRUE
    `;

    connection.query(sql, [employeeId, roleId, assignedBy], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  /**
   * Remove role (soft delete)
   */
  static removeRole(employeeId, roleId, callback) {
    const sql = `
      UPDATE employee_roles
      SET is_active = FALSE
      WHERE employee_id = ? AND role_id = ?
    `;
    db.query(sql, [employeeId, roleId], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  /**
   * Get roles
   */
  static getRoles(employeeId, callback) {
    const sql = `
      SELECT r.role_id, r.role_name
      FROM roles r
      JOIN employee_roles er ON r.role_id = er.role_id
      WHERE er.employee_id = ? AND er.is_active = TRUE
      ORDER BY er.assigned_at ASC
    `;
    db.query(sql, [employeeId], (err, rows) => {
      if (err) return callback(err, null);
      callback(null, Array.isArray(rows) ? rows : []);
    });
  }

  /**
   * Get primary role
   */
  static getPrimaryRole(employeeId, callback) {
    const sql = `
      SELECT r.role_name
      FROM roles r
      JOIN employee_roles er ON r.role_id = er.role_id
      WHERE er.employee_id = ? AND er.is_active = TRUE
      ORDER BY er.assigned_at ASC
      LIMIT 1
    `;
    db.query(sql, [employeeId], (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows[0]?.role_name || null);
    });
  }

  /**
   * Get permissions
   */
  static getPermissions(employeeId, callback) {
    const sql = `
      SELECT DISTINCT p.permission_name
      FROM permissions p
      JOIN role_permissions rp ON p.permission_id = rp.permission_id
      JOIN employee_roles er ON er.role_id = rp.role_id
      WHERE er.employee_id = ? AND er.is_active = TRUE
    `;
    db.query(sql, [employeeId], (err, rows) => {
      if (err) return callback(err, null);
      const permissions = Array.isArray(rows) ? rows.map(r => r.permission_name) : [];
      callback(null, permissions);
    });
  }
}

module.exports = EmployeeRoleModel;