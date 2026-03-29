const sql = require('./db.js');

const Transaction = function(transaction) {
  this.account_id = transaction.account_id;
  this.transaction_type = transaction.transaction_type;
  this.amount = transaction.amount;
  this.balance_after = transaction.balance_after;
  this.reference_code = transaction.reference_code;
  this.description = transaction.description;
};

Transaction.getFilteredHistoryByAccount = (accountId, filters, result) => {
  const { type, status, fromDate, toDate, minAmount, maxAmount } = filters;

  let query = `
    SELECT * FROM (
      /* Ledger */
      SELECT transaction_id AS id, created_at AS date, transaction_type AS type, 
             amount, 'completed' AS status, description
      FROM transactions WHERE account_id = ?

      UNION ALL

      /* M-Pesa */
      SELECT mpesa_id AS id, created_at AS date, 'deposit' AS type, 
             amount, status, CONCAT('M-Pesa: ', phone_number) AS description
      FROM mpesa_transactions WHERE account_id = ?

      UNION ALL

      /* Transfers */
      SELECT transfer_id AS id, created_at AS date, 'transfer' AS type, 
             amount, status, 
             CASE WHEN from_account = ? THEN 'Transfer Out' ELSE 'Transfer In' END AS description
      FROM transfers WHERE from_account = ? OR to_account = ?
    ) AS history
    WHERE 1=1`;

  const params = [accountId, accountId, accountId, accountId, accountId];

  // Dynamic Filtering Logic
  if (type && type !== 'all') {
    query += ` AND type = ?`;
    params.push(type);
  }
  if (status && status !== 'all') {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (fromDate) {
    query += ` AND date >= ?`;
    params.push(`${fromDate} 00:00:00`);
  }
  if (toDate) {
    query += ` AND date <= ?`;
    params.push(`${toDate} 23:59:59`);
  }
  if (minAmount) {
    query += ` AND amount >= ?`;
    params.push(minAmount);
  }
  if (maxAmount) {
    query += ` AND amount <= ?`;
    params.push(maxAmount);
  }

  query += ` ORDER BY date DESC`;

  sql.query(query, params, (err, res) => {
    if (err) return result(err, null);
    result(null, res);
  });
};

// --- ADMIN: GET ALL TRANSACTIONS GLOBALLY ---
Transaction.getAdminGlobalHistory = (filters, result) => {
  const { type, status, fromDate, toDate, minAmount, maxAmount } = filters;
  
  let query = `
    SELECT * FROM (
      SELECT t.transaction_id AS id, t.created_at AS date, t.transaction_type AS type, 
             a.account_number AS accountNumber, c.username AS customerName,
             t.description, t.amount, 'completed' AS status
      FROM transactions t
      JOIN accounts a ON t.account_id = a.account_id
      JOIN customers c ON a.customer_id = c.customer_id

      UNION ALL

      SELECT m.mpesa_id AS id, m.created_at AS date, 'deposit' AS type, 
             a.account_number AS accountNumber, c.username AS customerName,
             CONCAT('M-Pesa: ', m.phone_number) AS description, m.amount, m.status
      FROM mpesa_transactions m
      JOIN accounts a ON m.account_id = a.account_id
      JOIN customers c ON a.customer_id = c.customer_id

      UNION ALL

      SELECT tr.transfer_id AS id, tr.created_at AS date, 'transfer' AS type, 
             a1.account_number AS accountNumber, c1.username AS customerName,
             CONCAT('Transfer to #', a2.account_number) AS description, tr.amount, tr.status
      FROM transfers tr
      JOIN accounts a1 ON tr.from_account = a1.account_id
      JOIN customers c1 ON a1.customer_id = c1.customer_id
      JOIN accounts a2 ON tr.to_account = a2.account_id
    ) AS global_history
    WHERE 1=1`;

  const params = [];

  if (type && type !== 'all') {
    query += ` AND type = ?`;
    params.push(type);
  }
  if (status && status !== 'all') {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (fromDate) {
    query += ` AND date >= ?`;
    params.push(`${fromDate} 00:00:00`);
  }
  if (toDate) {
    query += ` AND date <= ?`;
    params.push(`${toDate} 23:59:59`);
  }
  if (minAmount) {
    query += ` AND amount >= ?`;
    params.push(minAmount);
  }
  if (maxAmount) {
    query += ` AND amount <= ?`;
    params.push(maxAmount);
  }

  query += ` ORDER BY date DESC`;

  sql.query(query, params, (err, res) => {
    if (err) return result(err, null);
    result(null, res);
  });
};

//  GET TOTAL COUNT - FIXED TO CALLBACK
Transaction.countAll = (result) => {
  sql.query("SELECT COUNT(*) AS total FROM transactions", (err, res) => {
    if (err) return result(err, null);
    result(null, res[0].total || 0);
  });
};

//  GET TOTAL VOLUME - FIXED TO CALLBACK
Transaction.getTotalVolume = (result) => {
  sql.query("SELECT SUM(amount) AS total_volume FROM transactions", (err, res) => {
    if (err) return result(err, null);
    result(null, res[0].total_volume || 0);
  });
};

//  CREATE NEW TRANSACTION
Transaction.create = (newTx, result) => {
  sql.query("INSERT INTO transactions SET ?", newTx, (err, res) => {
    if (err) return result(err, null);
    result(null, { id: res.insertId, ...newTx });
  });
};

//  FIND BY ACCOUNT ID
Transaction.getHistoryByAccount = (accountId, result) => {
  sql.query(
    "SELECT * FROM transactions WHERE account_id = ? ORDER BY created_at DESC",
    [accountId],
    (err, res) => {
      if (err) return result(err, null);
      result(null, res);
    }
  );
};

//  GET RECENT - FIXED TO CALLBACK
Transaction.getRecent = (limit, result) => {
  const query = `
    SELECT t.*, c.username 
    FROM transactions t
    JOIN accounts a ON t.account_id = a.account_id
    JOIN customers c ON a.customer_id = c.customer_id
    ORDER BY t.created_at DESC LIMIT ?`;
    
  sql.query(query, [limit], (err, res) => {
    if (err) return result(err, null);
    result(null, res);
  });
};

module.exports = Transaction;