const db = require("./db.js");

class AccountTransferModel {

  static transferBetweenAccounts(fromAccountId, toAccountId, amount, callback) {

    if (!fromAccountId || !toAccountId || !amount) {
      return callback(new Error("Missing required fields"), null);
    }

    amount = Number(amount);

    if (isNaN(amount) || amount <= 0) {
      return callback(new Error("Invalid amount"), null);
    }

    if (fromAccountId === toAccountId) {
      return callback(new Error("Cannot transfer to the same account"), null);
    }

    db.getConnection((err, connection) => {

      if (err) return callback(err, null);

      connection.beginTransaction(err => {

        if (err) {
          connection.release();
          return callback(err, null);
        }

        // Lock source account
        connection.query(
          "SELECT * FROM accounts WHERE account_id = ? FOR UPDATE",
          [fromAccountId],
          (err, fromRows) => {

            if (err) return rollback(err);

            if (!fromRows.length)
              return rollback(new Error("Source account not found"));

            const fromAccount = fromRows[0];

            // Lock target account
            connection.query(
              "SELECT * FROM accounts WHERE account_id = ? FOR UPDATE",
              [toAccountId],
              (err, toRows) => {

                if (err) return rollback(err);

                if (!toRows.length)
                  return rollback(new Error("Target account not found"));

                const toAccount = toRows[0];

                if (fromAccount.status !== "active")
                  return rollback(new Error("Source account is not active"));

                if (toAccount.status !== "active")
                  return rollback(new Error("Target account is not active"));

                if (fromAccount.balance < amount)
                  return rollback(new Error("Insufficient balance"));

                // Deduct balance
                connection.query(
                  "UPDATE accounts SET balance = balance - ? WHERE account_id = ?",
                  [amount, fromAccountId],
                  err => {

                    if (err) return rollback(err);

                    // Add balance
                    connection.query(
                      "UPDATE accounts SET balance = balance + ? WHERE account_id = ?",
                      [amount, toAccountId],
                      err => {

                        if (err) return rollback(err);

                        // Log sender transaction
                        connection.query(
                          `INSERT INTO transactions (account_id, transaction_type, amount, balance_after)
                           VALUES (?, 'transfer', ?, ?)`,
                          [fromAccountId, amount, fromAccount.balance - amount],
                          err => {

                            if (err) return rollback(err);

                            // Log receiver transaction
                            connection.query(
                              `INSERT INTO transactions (account_id, transaction_type, amount, balance_after)
                               VALUES (?, 'transfer', ?, ?)`,
                              [toAccountId, amount, toAccount.balance + amount],
                              err => {

                                if (err) return rollback(err);

                                connection.commit(err => {

                                  if (err) return rollback(err);

                                  connection.release();
                                  callback(null, { message: "Transfer successful" });

                                });

                              }
                            );

                          }
                        );

                      }
                    );

                  }
                );

              }
            );

          }
        );

        function rollback(error) {
          connection.rollback(() => {
            connection.release();
            callback(error, null);
          });
        }

      });

    });

  }

}

module.exports = AccountTransferModel;