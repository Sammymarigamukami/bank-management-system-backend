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

  static activateAccount(accountId, callback) {
    const sql = `
      UPDATE accounts 
      SET status = 'active'
      WHERE account_id = ?
    `;
    db.query(sql, [accountId], (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  }
}

module.exports = AccountModel;