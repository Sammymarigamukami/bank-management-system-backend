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

  static depositViaMpesa(accountId, amount, phone, mpesaCode, callback) {
    db.getConnection((err, connection) => {
      if (err) return callback(err);

      connection.beginTransaction(err => {
        if (err) return callback(err);

        // Prevent duplicate mpesa processing
        const sql = "SELECT * FROM mpesa_transactions WHERE mpesa_code = ?";
        connection.query(sql, [mpesaCode], (err, rows) => {
          if (err) return connection.rollback(() => callback(err));

          if (rows.length > 0) {
            return connection.rollback(() => callback(new Error("Duplicate M-pesa transaction")))
          }

          // insert mpesa transaction (pending)
          const sqlInsert = `INSERT INTO mpesa_transactions (account_id, phone_number, amount, mpesa_code, status)
            VALUES (?, ?, ?, ?, 'pending')`;
            connection.query(sqlInsert, [accountId, phone, amount, mpesaCode], (err, mpesaRes) => {
              if (err) return connection.rollback(() => callback(err));

              // update account balance
              const updateSql = `UPDATE accounts 
                SET balance = balance + ?
                WHERE account_id = ? AND status = 'active'`;
                connection.query(updateSql, [amount, accountId], (err, updateRes) => {
                  if (err) return connection.rollback(() => callback(err));

                  if (updateRes.affectedRows === 0) {
                    return connection.rollback(() => callback(new Error("Account not found or inactive")))
                  }
                  
                  // Get new balance
                  const balanceSql = "SELECT balance FROM accounts WHERE account_id = ?";
                  connection.query(balanceSql, [accountId], (err, balanceRows) => {
                    if (err) return connection.rollback(() => callback(err));

                    const newBalance = balanceRows[0].balance;

                    // insert into transaction table
                    const transactionSql = `INSERT INTO transactions
                    (account_id, transaction_type, amount, balance_after, reference_code, description)
                    VALUES (?, 'deposit', ?, ?, ?, 'M-Pesa deposit')`;
                    connection.query(transactionSql, [accountId, amount, newBalance, mpesaCode], (err) => {
                      if (err) return connection.rollback(() => callback(err));

                      const updateMpesaSql = `UPDATE mpesa_transactions SET status = 'completed' WHERE mpesa_code = ?`;
                      connection.query(updateMpesaSql, [mpesaCode], (err) => {
                        if (err) return connection.rollback(() => callback(err));

                        // commit transaction
                        connection.commit(err => {
                          if (err) return connection.rollback(() => callback(err));

                          callback(null, {
                            message: "Deposit successful",
                            balance: newBalance,
                            amount,
                            mpesaCode
                          })
                        })
                      })
                  })
                })
            })
        })
      })
    })
  })};

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