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

  static findByPhone(phone, callback) {
    const sql = `
      SELECT a.account_id, a.customer_id, a.account_number, a.account_type, a.balance, a.status, c.phone
      FROM accounts a
      JOIN customers c ON a.customer_id = c.customer_id
      WHERE c.phone = ? AND a.status = 'active'
      LIMIT 1
    `;

    db.query(sql, [phone], (err, results) => {
      if (err) {
        console.error('DB error in findByPhone:', err);
        return callback(err, null);
      }

      if (results.length === 0) {
        return callback(null, null); // not found
      }

      callback(null, results[0]);
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


static getActiveAccounts(customerID, callback) {

  const query = `
    SELECT 
      account_id,
      account_number,
      account_type,
      currency,
      balance,
      status
    FROM accounts
    WHERE customer_id = ?
      AND account_type = 'current'
  `;

  db.query(query, [customerID], (err, res) => {
    if (err) {
      console.error("DB error (getActiveAccounts):", err);
      return callback(err, null);
    }

    const accounts = (res || []).map(acc => ({
      id: acc.account_id,
      number: acc.account_number,
      type: acc.account_type,
      currency: acc.currency,
      balance: acc.balance ? Number(acc.balance) : 0,
      status: acc.status
    }));

    return callback(null, accounts);
  });
 }
}


module.exports = AccountModel;