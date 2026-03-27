const sql = require('./db.js');

class SessionModel {

  static create(session, callback) {
    const sql = `
      INSERT INTO employee_sessions 
      (employee_id, login_time, ip_address)
      VALUES (?, NOW(), ?)
    `;
    db.query(sql, [session.employee_id, session.ip_address], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

}

module.exports = SessionModel;