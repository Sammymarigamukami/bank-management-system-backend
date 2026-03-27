const db = require('./db.js');

class RolePermissionModel {

  static assignPermission(roleId, permissionId, callback) {
    const sql = `
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (?, ?)
    `;

    db.query(sql, [roleId, permissionId], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  static getPermissionsByRole(roleId, callback) {
    const sql = `
      SELECT p.permission_name
      FROM permissions p
      JOIN role_permissions rp ON p.permission_id = rp.permission_id
      WHERE rp.role_id = ?
    `;

    db.query(sql, [roleId], (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows.map(r => r.permission_name));
    });
  }

}

module.exports = RolePermissionModel;