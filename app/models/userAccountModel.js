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


  static transferFundsByAccountId(senderCustomerId, receiverAccountId, amount, description, callback) {
    // 1. Get a dedicated connection from the pool
    db.getConnection((err, connection) => {
      if (err) return callback(err);

      // 2. Start Transaction
      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          return callback(err);
        }

        const rollback = (error) => {
          connection.rollback(() => {
            connection.release();
            callback(error);
          });
        };

        // 3. Check Sender Balance and Lock Row using customer_id
        const checkSenderSql = "SELECT balance, account_number, account_id FROM accounts WHERE customer_id = ? FOR UPDATE";
        connection.query(checkSenderSql, [senderCustomerId], (err, senderRows) => {
          if (err) return rollback(err);
          if (senderRows.length === 0) return rollback(new Error("Sender account not found"));

          const sender = senderRows[0];
          const senderPK = sender.account_id; // Primary Key for transactions table

          if (parseFloat(sender.balance) < parseFloat(amount)) {
            return rollback(new Error("Insufficient funds"));
          }

          // 4. Check Receiver Existence and Lock Row via account_id
          const checkReceiverSql = "SELECT account_id, account_number, customer_id FROM accounts WHERE account_id = ? FOR UPDATE";
          connection.query(checkReceiverSql, [receiverAccountId], (err, receiverRows) => {
            if (err) return rollback(err);
            if (receiverRows.length === 0) return rollback(new Error("Recipient account not found"));

            const receiver = receiverRows[0];
            const receiverPK = receiver.account_id;
            const receiverAccNum = receiver.account_number;

            if (receiverPK === senderPK) {
              return rollback(new Error("Cannot transfer to yourself"));
            }

            // 5. Deduct from Sender using customer_id
            const deductSql = "UPDATE accounts SET balance = balance - ? WHERE customer_id = ?";
            connection.query(deductSql, [amount, senderCustomerId], (err) => {
              if (err) return rollback(err);

              // 6. Add to Receiver using account_id
              const addSql = "UPDATE accounts SET balance = balance + ? WHERE account_id = ?";
              connection.query(addSql, [amount, receiverAccountId], (err) => {
                if (err) return rollback(err);

                const refCode = `TRF-${Math.random().toString(36).toUpperCase().slice(2, 10)}`;

                // 7. Record Sender Transaction (Using account_id PK)
                const senderTxSql = `INSERT INTO transactions (account_id, amount, transaction_type, description, reference_code) 
                                     VALUES (?, ?, 'withdrawal', ?, ?)`;
                const senderDesc = `Transfer to Acc #${receiverAccNum}: ${description}`;
                
                connection.query(senderTxSql, [senderPK, -amount, senderDesc, refCode], (err) => {
                  if (err) return rollback(err);

                  // 8. Record Receiver Transaction (Using account_id PK)
                  const receiverTxSql = `INSERT INTO transactions (account_id, amount, transaction_type, description, reference_code) 
                                         VALUES (?, ?, 'deposit', ?, ?)`;
                  const receiverDesc = `Received from Acc #${sender.account_number}: ${description}`;

                  connection.query(receiverTxSql, [receiverPK, amount, receiverDesc, refCode], (err) => {
                    if (err) return rollback(err);

                    // 9. Final Commit
                    connection.commit((err) => {
                      if (err) return rollback(err);

                      connection.release();
                      callback(null, { success: true, referenceCode: refCode });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  
  static transferFundsByCustomerId(senderCustomerId, receiverCustomerId, amount, description, callback) {
    // 1. Get a dedicated connection from the pool
    db.getConnection((err, connection) => {
      if (err) return callback(err);

      // 2. Start Transaction
      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          return callback(err);
        }

        const rollback = (error) => {
          connection.rollback(() => {
            connection.release();
            callback(error);
          });
        };

        // 3. Find SENDER'S account_id and balance using customer_id
        const checkSenderSql = "SELECT account_id, balance, account_number FROM accounts WHERE customer_id = ? FOR UPDATE";
        connection.query(checkSenderSql, [senderCustomerId], (err, senderRows) => {
          if (err) return rollback(err);
          if (senderRows.length === 0) return rollback(new Error("Sender account not found"));

          const sender = senderRows[0];
          const senderPK = sender.account_id; // Primary Key needed for transactions table

          if (parseFloat(sender.balance) < parseFloat(amount)) {
            return rollback(new Error("Insufficient funds"));
          }

          // 4. Find RECEIVER'S account_id via customer_id
          const checkReceiverSql = "SELECT account_id, account_number FROM accounts WHERE customer_id = ? FOR UPDATE";
          connection.query(checkReceiverSql, [receiverCustomerId], (err, receiverRows) => {
            if (err) return rollback(err);
            if (receiverRows.length === 0) return rollback(new Error("Recipient user does not have an active account"));

            const receiver = receiverRows[0];
            const receiverPK = receiver.account_id; // Primary Key needed for transactions table
            const receiverAccNum = receiver.account_number;

            if (senderPK === receiverPK) {
              return rollback(new Error("Cannot transfer to yourself"));
            }

            // 5. Deduct from Sender
            const deductSql = "UPDATE accounts SET balance = balance - ? WHERE account_id = ?";
            connection.query(deductSql, [amount, senderPK], (err) => {
              if (err) return rollback(err);

              // 6. Add to Receiver
              const addSql = "UPDATE accounts SET balance = balance + ? WHERE account_id = ?";
              connection.query(addSql, [amount, receiverPK], (err) => {
                if (err) return rollback(err);

                const refCode = `TRF-${Math.random().toString(36).toUpperCase().slice(2, 10)}`;

                // 7. Record Sender Transaction (Using account_id PK)
                const senderTxSql = `INSERT INTO transactions (account_id, amount, transaction_type, description, reference_code) 
                                     VALUES (?, ?, 'withdrawal', ?, ?)`;
                const senderDesc = `Transfer to Cust#${receiverCustomerId} (Acc: ${receiverAccNum}): ${description}`;
                
                connection.query(senderTxSql, [senderPK, -amount, senderDesc, refCode], (err) => {
                  if (err) return rollback(err);

                  // 8. Record Receiver Transaction (Using account_id PK)
                  const receiverTxSql = `INSERT INTO transactions (account_id, amount, transaction_type, description, reference_code) 
                                         VALUES (?, ?, 'deposit', ?, ?)`;
                  const receiverDesc = `Received from Acc ${sender.account_number}: ${description}`;

                  connection.query(receiverTxSql, [receiverPK, amount, receiverDesc, refCode], (err) => {
                    if (err) return rollback(err);

                    // 9. Final Commit
                    connection.commit((err) => {
                      if (err) return rollback(err);
                      connection.release();
                      callback(null, { 
                        success: true, 
                        referenceCode: refCode,
                        recipientAccount: receiverAccNum 
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }
}

module.exports = AccountModel;