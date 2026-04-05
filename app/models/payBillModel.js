const db = require("./db.js");

class PaybillModel {
  /**
   * Process a Paybill Transaction
   * Input: customerId, businessNumber, accountReference, amount, description
   */
static processPayment(paymentData, callback) {
    const {
      customerId,
      businessNumber,
      accountReference,
      amount,
      description
    } = paymentData;

    const referenceCode = `PAY-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    db.getConnection((err, connection) => {
      if (err) return callback(err);

      console.log("[Paybill] Starting transaction for customer:", customerId);

      // 2. Start Transaction on the individual connection
      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          return callback(err);
        }

        // 3. Get User's Account and Lock Row (FOR UPDATE)
        const checkAccSql = `
          SELECT account_id as account_id, balance 
          FROM accounts 
          WHERE customer_id = ? AND account_type = 'current' 
          FOR UPDATE`;

        connection.query(checkAccSql, [customerId], (err, accounts) => {
          if (err || accounts.length === 0) {
            return connection.rollback(() => {
              connection.release();
              callback(err || new Error("Source account not found"));
            });
          }

          const account = accounts[0];

          // 4. Validate Funds
          if (parseFloat(account.balance) < parseFloat(amount)) {
            return connection.rollback(() => {
              connection.release();
              callback(new Error("Insufficient funds for this payment"));
            });
          }

          // 5. Deduct from Account
          const deductSql = "UPDATE accounts SET balance = balance - ? WHERE account_id = ?";
          connection.query(deductSql, [amount, account.account_id], (err) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                callback(err);
              });
            }

            // 6. Insert into General Transactions Table
            const txSql = `
              INSERT INTO transactions 
              (account_id, transaction_type, amount, description, reference_code) 
              VALUES (?, 'paybill', ?, ?, ?)`;
            
            const txDesc = `Paybill ${businessNumber} Acc: ${accountReference}`;

            connection.query(txSql, [account.account_id, -amount, txDesc, referenceCode], (err, txResult) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  callback(err);
                });
              }

              const transactionId = txResult.insertId;

              // 7. Insert into Paybill Metadata Table
              const paybillSql = `
                INSERT INTO paybill_payments 
                (transaction_id, business_number, account_reference, amount, raw_description) 
                VALUES (?, ?, ?, ?, ?)`;

              connection.query(paybillSql, [transactionId, businessNumber, accountReference, amount, description || null], (err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    callback(err);
                  });
                }

                // 8. Commit and Release
                connection.commit((err) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      callback(err);
                    });
                  }
                  
                  connection.release(); // IMPORTANT: Put the connection back in the pool
                  
                  callback(null, {
                    success: true,
                    transactionId,
                    referenceCode,
                    amount: parseFloat(amount),
                    newBalance: parseFloat(account.balance) - parseFloat(amount)
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  /**
   * Fetch Paybill History for a specific user
   */
  static getHistory(customerId, callback) {
    const sql = `
      SELECT 
        p.business_number, 
        p.account_reference, 
        p.amount, 
        t.reference_code, 
        t.created_at as payment_date,
        m.business_name
      FROM paybill_payments p
      JOIN transactions t ON p.transaction_id = t.transaction_id
      JOIN accounts a ON t.account_id = a.account_id
      LEFT JOIN merchants m ON p.business_number = m.paybill_number
      WHERE a.customer_id = ?
      ORDER BY t.created_at DESC`;

    db.query(sql, [customerId], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows);
    });
  }
}

module.exports = PaybillModel;