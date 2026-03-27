const sql = require('./db.js');

class AuditLogModel {

  static log(entry, callback) {
    const sql = `
      INSERT INTO audit_logs 
      (employee_id, action, entity, entity_id, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.query(sql, [
      entry.employee_id,
      entry.action,
      entry.entity,
      entry.entity_id,
      entry.ip_address
    ], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

}
module.exports = AuditLogModel;