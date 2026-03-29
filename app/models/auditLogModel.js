
const db = require('./db.js'); 

const Audit = function() {};

Audit.log = (entry, callback) => {
    const query = `
      INSERT INTO audit_logs 
      (employee_id, action, entity, entity_id, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(query, [
      entry.employee_id,
      entry.action,
      entry.entity,
      entry.entity_id,
      entry.ip_address
    ], (err, result) => {
      if (err) {
        console.error("Audit Log Error:", err);
        return callback(err, null);
      }
      callback(null, result);
    });
};

module.exports = Audit;