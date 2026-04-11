const db = require("./db.js");

class FixedDepositModel {
  /**
   * 1. Create and Activate FD
   * Transfers funds from Savings to FD and creates the record.
   */
static create(fdData, callback) {
    const { customer_id, account_id, amount, durationMonths, interestRate } = fdData;

    db.getConnection((err, connection) => {
        if (err) return callback(err);

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                return callback(err);
            }

            // Step 1: Check balance
            const checkBal = "SELECT balance FROM accounts WHERE account_id = ? AND customer_id = ?";
            connection.query(checkBal, [account_id, customer_id], (err, rows) => {
                if (err || rows.length === 0 || rows[0].balance < amount) {
                    return connection.rollback(() => {
                        connection.release();
                        callback(new Error("Insufficient balance to open Fixed Deposit"));
                    });
                }

                const newBalance = parseFloat(rows[0].balance) - parseFloat(amount);

                // Step 2: Deduct from Savings
                const deduct = "UPDATE accounts SET balance = ? WHERE account_id = ?";
                connection.query(deduct, [newBalance, account_id], (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            callback(err);
                        });
                    }

                    // Step 3: Calculate dates and Insert FD Record
                    const maturityDate = new Date();
                    maturityDate.setMonth(maturityDate.getMonth() + parseInt(durationMonths));

                    const insertFD = `
                        INSERT INTO fd_accounts 
                        (customer_id, account_id, principal_amount, interest_rate, start_date, maturity_date, status)
                        VALUES (?, ?, ?, ?, NOW(), ?, 'active')`;

                    connection.query(insertFD, [customer_id, account_id, amount, interestRate, maturityDate], (err, fdResult) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                callback(err);
                            });
                        }

                        // Step 4: Log to Transactions table
                        const refCode = `FD-REF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                        const insertTx = `
                            INSERT INTO transactions 
                            (account_id, transaction_type, amount, balance_after, reference_code, description)
                            VALUES (?, 'transfer', ?, ?, ?, ?)`;

                        const description = `Fixed Deposit Creation - ${durationMonths} Months`;
                        
                        // Amount is negative because it is leaving the savings account
                        connection.query(insertTx, [account_id, -amount, newBalance, refCode, description], (err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    callback(err);
                                });
                            }

                            // Step 5: Commit
                            connection.commit((err) => {
                                if (err) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        callback(err);
                                    });
                                }
                                connection.release();
                                callback(null, { fd_id: fdResult.insertId, reference_code: refCode });
                            });
                        });
                    });
                });
            });
        });
    });
}

  /**
   * 2. Get Eligible Collateral
   * Returns active FDs that are NOT already held as collateral.
   */
  static getEligibleCollateral(customerId, callback) {
    const sql = `
      SELECT fd_id, principal_amount, interest_rate, maturity_date 
      FROM fd_accounts 
      WHERE customer_id = ? AND status = 'active'`;
    db.query(sql, [customerId], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows);
    });
  }

  /**
   * 3. Hold as Collateral
   * Updates status when an online loan is taken against this FD.
   */
  static setAsCollateral(fdId, callback) {
    const sql = "UPDATE fd_accounts SET status = 'held_as_collateral' WHERE fd_id = ? AND status = 'active'";
    db.query(sql, [fdId], (err, result) => {
      if (err) return callback(err);
      if (result.affectedRows === 0) return callback(new Error("FD not available for collateral"));
      callback(null, true);
    });
  }

  /**
   * 4. Release Collateral
   * Returns FD to active status once the loan is fully paid.
   */
  static releaseCollateral(fdId, callback) {
    const sql = "UPDATE fd_accounts SET status = 'active' WHERE fd_id = ? AND status = 'held_as_collateral'";
    db.query(sql, [fdId], callback);
  }
}

module.exports = FixedDepositModel;