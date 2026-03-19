const db = require("./db.js");

class AccountModel {

  static findByAccountId(accountId, callback) {
    const sql = "SELECT * FROM accounts WHERE account_id = ?";
    db.query(sql, [accountId], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0]);
    });
  }

  static findByAccountNumber(accountNumber, callback) {
    const sql = "SELECT * FROM accounts WHERE account_number = ?";
    db.query(sql, [accountNumber], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0]);
    });
  }

  static deposit(accountId, amount, callback) {
    const sql = `
      UPDATE accounts 
      SET balance = balance + ? 
      WHERE account_id = ? AND status = 'active'
    `;
    db.query(sql, [amount, accountId], (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  }

  static withdraw(accountId, amount, callback) {
    const sql = `
      UPDATE accounts 
      SET balance = balance - ?
      WHERE account_id = ?
      AND balance >= ?
      AND status = 'active'
    `;
    db.query(sql, [amount, accountId, amount], (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  }

  static freezeAccount(accountId, callback) {
    const sql = `
      UPDATE accounts 
      SET status = 'frozen'
      WHERE account_id = ?
    `;
    db.query(sql, [accountId], (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  }

  static updateAccountStatus(accountId, newStatus, callback) {
  // get current state
  const getSql = "SELECT status FROM accounts WHERE account_id = ?";

  db.query(getSql, [accountId], (err, rows) => {
    if (err) return callback(err);

    if (rows.length === 0) {
      return callback(new Error("Account not found"));
    }

    const currentStatus = rows[0].status;

    // define allowed transitions
    const allowedTransitions = {
      not_active: ['active'],
      active: ['frozen', 'closed'],
      frozen: ['active', 'closed'],
      closed: [] // terminal state
    };

    // Validate transition
    if (!allowedTransitions[currentStatus].includes(newStatus)) {
      return callback(
        new Error(`Invalid transition: ${currentStatus} → ${newStatus}`)
      );
    }

    // update
    const updateSql = `
      UPDATE accounts
      SET status = ?
      WHERE account_id = ?
    `;

    db.query(updateSql, [newStatus, accountId], (err, result) => {
      if (err) return callback(err);

      if (result.affectedRows === 0) {
        return callback(new Error("Status update failed"));
      }

      callback(null, {
        message: `Account status changed from ${currentStatus} to ${newStatus}`
      });
    });
  });
}
}

module.exports = AccountModel;