const db = require("./db.js");

class AccountTransferModel {
  /**
   * Internal Transfer between own accounts (e.g., Current to Savings)
   * This method validates ownership and strictly checks account status 'active'.
   */
  static transferBetweenOwnAccounts(customerId, fromAccountId, toAccountId, amount, callback) {
    if (!customerId || !fromAccountId || !toAccountId || !amount) {
      return callback(new Error("Missing required fields"), null);
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return callback(new Error("Invalid amount"), null);
    }

    if (fromAccountId === toAccountId) {
      return callback(new Error("Source and destination accounts must be different"), null);
    }

    // Generate unique internal reference
    const referenceCode = `INT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    db.getConnection((err, connection) => {
      if (err) return callback(err, null);

      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          return callback(err, null);
        }

        const rollback = (error) => {
          connection.rollback(() => {
            connection.release();
            callback(error, null);
          });
        };

        /**
         * 1. VALIDATION & LOCKING
         * We fetch both accounts while checking ownership (customer_id).
         * 'FOR UPDATE' locks the rows to prevent concurrent balance changes.
         */
        const ownershipSql = `
          SELECT account_id, balance, status, account_type, account_number 
          FROM accounts 
          WHERE account_id IN (?, ?) AND customer_id = ? 
          FOR UPDATE`;

        connection.query(ownershipSql, [fromAccountId, toAccountId, customerId], (err, rows) => {
          if (err) return rollback(err);
          
          if (rows.length !== 2) {
            return rollback(new Error("One or both accounts not found or do not belong to you."));
          }

          const fromAccount = rows.find(r => r.account_id == fromAccountId);
          const toAccount = rows.find(r => r.account_id == toAccountId);

          // 2. STATUS CHECK (ENUM: 'not_active', 'active', 'frozen', 'closed')
          // Only 'active' accounts can send or receive internal transfers
          if (fromAccount.status !== 'active') {
            return rollback(new Error(`Source ${fromAccount.account_type} account is ${fromAccount.status}. Only active accounts can send funds.`));
          }
          
          if (toAccount.status !== 'active') {
            return rollback(new Error(`Target ${toAccount.account_type} account is ${toAccount.status}. Only active accounts can receive funds.`));
          }

          // 3. BALANCE CHECK
          if (parseFloat(fromAccount.balance) < numericAmount) {
            return rollback(new Error(`Insufficient funds in your ${fromAccount.account_type} account.`));
          }

          // 4. EXECUTE TRANSFER
          const deductSql = "UPDATE accounts SET balance = balance - ? WHERE account_id = ?";
          const addSql = "UPDATE accounts SET balance = balance + ? WHERE account_id = ?";

          connection.query(deductSql, [numericAmount, fromAccountId], (err) => {
            if (err) return rollback(err);

            connection.query(addSql, [numericAmount, toAccountId], (err) => {
              if (err) return rollback(err);

              // 5. DOUBLE-ENTRY LOGGING
              // We log a record for both sides of the internal move
              const txSql = `
                INSERT INTO transactions 
                (account_id, transaction_type, amount, description, reference_code) 
                VALUES (?, 'transfer', ?, ?, ?)`;

              const senderDesc = `Transfer to ${toAccount.account_type} (${toAccount.account_number})`;
              const receiverDesc = `Transfer from ${fromAccount.account_type} (${fromAccount.account_number})`;

              // Debit entry
              connection.query(txSql, [fromAccountId, -numericAmount, senderDesc, referenceCode], (err) => {
                if (err) return rollback(err);

                // Credit entry
                connection.query(txSql, [toAccountId, numericAmount, receiverDesc, referenceCode], (err) => {
                  if (err) return rollback(err);

                  connection.commit((err) => {
                    if (err) return rollback(err);
                    
                    connection.release();
                    callback(null, { 
                      success: true, 
                      referenceCode,
                      from: fromAccount.account_type,
                      to: toAccount.account_type,
                      amount: numericAmount,
                      newSourceBalance: parseFloat(fromAccount.balance) - numericAmount
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


  static getSpendingByCategories(customerId, callback) {
    const sql = `
      SELECT 
        transaction_type as category, 
        SUM(ABS(amount)) as total_amount,
        COUNT(*) as transaction_count
      FROM transactions t
      JOIN accounts a ON t.account_id = a.account_id
      WHERE a.customer_id = ? AND t.amount < 0
      GROUP BY transaction_type`;
    
    db.query(sql, [customerId], callback);
  }

  static getMonthlyTrends(customerId, callback) {
    const sql = `
      SELECT 
        DATE_FORMAT(t.created_at, '%Y-%m') as month,
        SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as income,
        SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as expenses
      FROM transactions t
      JOIN accounts a ON t.account_id = a.account_id
      WHERE a.customer_id = ?
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6`;

    db.query(sql, [customerId], callback);
  }

  static getBudgetAnalytics(customerId, callback) {
    const sql = `
      SELECT 
        a.account_type,
        a.balance as current_balance,
        COALESCE(SUM(ABS(t.amount)), 0) as monthly_spending
      FROM accounts a
      LEFT JOIN transactions t ON a.account_id = t.account_id 
        AND t.amount < 0 
        AND MONTH(t.created_at) = MONTH(CURRENT_DATE())
      WHERE a.customer_id = ?
      GROUP BY a.account_id`;

    db.query(sql, [customerId], callback);
  }
}

module.exports = AccountTransferModel;