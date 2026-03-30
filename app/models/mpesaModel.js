const sql = require('./db.js');

const MpesaTransaction = function(tx) {
  this.account_id = tx.account_id;
  this.phone_number = tx.phone_number;
  this.amount = tx.amount;
  this.mpesa_code = tx.mpesa_code || null;
  this.checkout_request_id = tx.checkout_request_id;
  this.merchant_request_id = tx.merchant_request_id;
  this.reference_code = tx.reference_code;
  this.status = tx.status || 'pending';
};

//  Create Record (Callback)
MpesaTransaction.create = (newTx, result) => {
  sql.query("INSERT INTO mpesa_transactions SET ?", newTx, (err, res) => {
    if (err) return result(err, null);
    result(null, { id: res.insertId, ...newTx });
  });
};


MpesaTransaction.updateStatusByCheckoutID = (checkoutID, updateData, result) => {
  // 1. Get a connection for the transaction
  sql.getConnection((err, connection) => {
    if (err) return result(err, null);

    connection.beginTransaction((err) => {
      if (err) return connection.release(), result(err, null);

      // A. Get the original M-Pesa record to find account_id and amount
      const findSql = "SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?";
      connection.query(findSql, [checkoutID], (err, rows) => {
        if (err || rows.length === 0) {
          return connection.rollback(() => {
            connection.release();
            result(err || { kind: "not_found" }, null);
          });
        }

        const mpesaTx = rows[0];
        const { account_id, amount } = mpesaTx;

        // B. Update M-Pesa Transaction Status
        const updateMpesaSql = `
          UPDATE mpesa_transactions 
          SET status = ?, mpesa_code = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE checkout_request_id = ?`;
        
        connection.query(updateMpesaSql, [updateData.status, updateData.mpesa_code, checkoutID], (err) => {
          if (err) return connection.rollback(() => { connection.release(); result(err, null); });

          // If the status isn't 'completed', we stop here and commit (e.g., if it failed)
          if (updateData.status !== 'completed') {
            return connection.commit((err) => {
              connection.release();
              if (err) return result(err, null);
              result(null, { message: "Status updated (not completed)" });
            });
          }

          // C. Update Account Balance (Strictly 'current' account)
          const updateAccountSql = `
            UPDATE accounts 
            SET balance = balance + ? 
            WHERE account_id = ? AND account_type = 'current' AND status = 'active'`;
          
          connection.query(updateAccountSql, [amount, account_id], (err, accountRes) => {
            if (err || accountRes.affectedRows === 0) {
              return connection.rollback(() => {
                connection.release();
                result(err || { kind: "invalid_account", message: "Account is not 'current' or not 'active'" }, null);
              });
            }

            // D. Fetch new balance for the ledger
            connection.query("SELECT balance FROM accounts WHERE account_id = ?", [account_id], (err, balanceRows) => {
              if (err) return connection.rollback(() => { connection.release(); result(err, null); });
              
              const newBalance = balanceRows[0].balance;

              // E. Insert into General Transactions table
              const ledgerSql = `
                INSERT INTO transactions 
                (account_id, transaction_type, amount, balance_after, reference_code, description) 
                VALUES (?, 'deposit', ?, ?, ?, ?)`;
              
              const description = `M-Pesa Deposit: ${updateData.mpesa_code}`;
              
              connection.query(ledgerSql, [account_id, amount, newBalance, updateData.mpesa_code, description], (err) => {
                if (err) return connection.rollback(() => { connection.release(); result(err, null); });

                // F. Final Commit
                connection.commit((err) => {
                  if (err) return connection.rollback(() => { connection.release(); result(err, null); });
                  
                  connection.release();
                  result(null, { success: true, newBalance });
                });
              });
            });
          });
        });
      });
    });
  });
};

MpesaTransaction.findByCheckoutId = (checkoutID, result) => {
  sql.query("SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?", [checkoutID], (err, res) => {
    if (err) return result(err, null);
    if (res.length) return result(null, res[0]);
    result({ kind: "not_found" }, null);
  });
};

//  Admin: Get Completed (REWRITTEN TO CALLBACK)
MpesaTransaction.getCompleted = (result) => {
  const query = `
    SELECT m.*, c.username, a.account_number 
    FROM mpesa_transactions m
    JOIN accounts a ON m.account_id = a.account_id
    JOIN customers c ON a.customer_id = c.customer_id
    WHERE m.status = 'completed'
    ORDER BY m.created_at DESC
  `;
  sql.query(query, (err, res) => {
    if (err) return result(err, null);
    result(null, res);
  });
};

//  Stats: Total Collected (REWRITTEN TO CALLBACK)
MpesaTransaction.getTotalCollected = (result) => {
  sql.query("SELECT SUM(amount) AS total FROM mpesa_transactions WHERE status = 'completed'", (err, res) => {
    if (err) return result(err, null);
    result(null, res[0].total || 0);
  });
};

//  Stats: Count All (For your Dashboard)
MpesaTransaction.countAll = (result) => {
  sql.query("SELECT COUNT(*) AS total FROM mpesa_transactions", (err, res) => {
    if (err) return result(err, null);
    result(null, res[0].total || 0);
  });
};

// Link Request IDs (REWRITTEN TO CALLBACK)
MpesaTransaction.setCheckoutIDs = (referenceCode, merchantID, checkoutID) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE mpesa_transactions 
      SET merchant_request_id = ?, checkout_request_id = ? 
      WHERE reference_code = ?
    `;
    sql.query(query, [merchantID, checkoutID, referenceCode], (err, res) => {
      if (err) return reject(err);
      if (res.affectedRows === 0) return reject({ kind: "not_found" });
      resolve(res);
    });
  });
};

module.exports = MpesaTransaction;