const db = require('./db.js');

class CustomerRoleModel {

  /**
   * Assign role (idempotent)
   */
  static assignRole(customerId, roleId, assignedBy = null, callback) {
    const sql = `
      INSERT INTO customer_roles (customer_id, role_id, assigned_by, is_active)
      VALUES (?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE is_active = TRUE
    `;

    db.query(sql, [customerId, roleId, assignedBy], (err, result) => {
        console.log("if error assigning role: ", err);
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  /**
   * Remove role (soft delete)
   */
  static removeRole(customerId, roleId, callback) {
    const sql = `
      UPDATE customer_roles
      SET is_active = FALSE
      WHERE customer_id = ? AND role_id = ?
    `;

    db.query(sql, [customerId, roleId], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  /**
   * Get all active roles
   */
  static getRoles(customerId, callback) {
    const sql = `
      SELECT r.role_id, r.role_name
      FROM roles r
      JOIN customer_roles cr ON r.role_id = cr.role_id
      WHERE cr.customer_id = ? AND cr.is_active = TRUE
      ORDER BY cr.assigned_at ASC
    `;

    db.query(sql, [customerId], (err, rows) => {
      if (err) return callback(err, null);
      callback(null, Array.isArray(rows) ? rows : []);
    });
  }

  /**
   * Get primary role (first assigned)
   */
  static getPrimaryRole(customerId, callback) {
    const sql = `
      SELECT r.role_name
      FROM roles r
      JOIN customer_roles cr ON r.role_id = cr.role_id
      WHERE cr.customer_id = ? AND cr.is_active = TRUE
      ORDER BY cr.assigned_at ASC
      LIMIT 1
    `;

    db.query(sql, [customerId], (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows[0]?.role_name || null);
    });
  }

  /**
   * Get permissions (if you use role_permissions)
   */
  static getPermissions(customerId, callback) {
    const sql = `
      SELECT DISTINCT p.permission_name
      FROM permissions p
      JOIN role_permissions rp ON p.permission_id = rp.permission_id
      JOIN customer_roles cr ON cr.role_id = rp.role_id
      WHERE cr.customer_id = ? AND cr.is_active = TRUE
    `;

    db.query(sql, [customerId], (err, rows) => {
      if (err) return callback(err, null);

      const permissions = rows.map(r => r.permission_name);
      callback(null, permissions);
    });
  }

  /**
   * Check if customer has role
   */
  static hasRole(customerId, roleName, callback) {
    const sql = `
      SELECT 1
      FROM customer_roles cr
      JOIN roles r ON cr.role_id = r.role_id
      WHERE cr.customer_id = ? 
        AND r.role_name = ?
        AND cr.is_active = TRUE
      LIMIT 1
    `;

    db.query(sql, [customerId, roleName], (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows.length > 0);
    });
  }

}

module.exports = CustomerRoleModel;