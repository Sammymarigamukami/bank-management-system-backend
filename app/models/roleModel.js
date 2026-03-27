const db = require("./db.js");

class RoleModel {

  static create(role, callback) {
    if (!role.role_name) {
      return callback(new Error("Role name is required"), null);
    }

    const sql = `
      INSERT INTO roles (role_name, description)
      VALUES (?, ?)
    `;

    db.query(sql, [role.role_name, role.description], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    }); }

  static getAll(callback) {
    db.query("SELECT * FROM roles", (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows);
    });
  }

  static findById(roleId, callback) {
    db.query("SELECT * FROM roles WHERE role_id = ?", [roleId], (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows[0] || null);
    });
  }

  static findByName(roleName, callback) {
    const sql = "SELECT * FROM roles WHERE role_name = ?";
    db.query(sql, [roleName], (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows[0] || null);
    });
  }
}

module.exports = RoleModel;