const db = require('./db.js');

class PermissionModel {

  // 🔹 CREATE
  static create(permission, callback) {
    if (!permission.permission_name) {
      return callback(new Error("Permission name required"), null);
    }

    const sql = `
      INSERT INTO permissions (permission_name, description)
      VALUES (?, ?)
    `;

    db.query(sql, [permission.permission_name, permission.description], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return callback(new Error("Permission already exists"), null);
        }
        return callback(err, null);
      }

      callback(null, result);
    });
  }

  // 🔹 GET ALL
  static getAll(callback) {
    const sql = "SELECT * FROM permissions ORDER BY permission_name ASC";

    db.query(sql, (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows);
    });
  }

  // 🔹 GET BY ID
  static getById(permissionId, callback) {
    const sql = "SELECT * FROM permissions WHERE permission_id = ?";

    db.query(sql, [permissionId], (err, rows) => {
      if (err) return callback(err, null);

      if (!rows.length) {
        return callback({ kind: "not_found" }, null);
      }

      callback(null, rows[0]);
    });
  }

  // 🔹 GET BY NAME (VERY IMPORTANT)
  static getByName(name, callback) {
    const sql = "SELECT * FROM permissions WHERE permission_name = ?";

    db.query(sql, [name], (err, rows) => {
      if (err) return callback(err, null);

      if (!rows.length) {
        return callback({ kind: "not_found" }, null);
      }

      callback(null, rows[0]);
    });
  }

  // 🔹 UPDATE
  static update(permissionId, data, callback) {
    const sql = `
      UPDATE permissions
      SET permission_name = ?, description = ?
      WHERE permission_id = ?
    `;

    db.query(sql, [data.permission_name, data.description, permissionId], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return callback(new Error("Permission name already exists"), null);
        }
        return callback(err, null);
      }

      if (result.affectedRows === 0) {
        return callback({ kind: "not_found" }, null);
      }

      callback(null, result);
    });
  }

  // 🔹 DELETE
  static delete(permissionId, callback) {
    const sql = "DELETE FROM permissions WHERE permission_id = ?";

    db.query(sql, [permissionId], (err, result) => {
      if (err) return callback(err, null);

      if (result.affectedRows === 0) {
        return callback({ kind: "not_found" }, null);
      }

      callback(null, result);
    });
  }

}

module.exports = PermissionModel;