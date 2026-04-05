const sql = require('./db.js');

const Transaction = function(transaction) {
  this.account_id = transaction.account_id;
  this.transaction_type = transaction.transaction_type;
  this.amount = transaction.amount;
  this.balance_after = transaction.balance_after;
  this.reference_code = transaction.reference_code;
  this.description = transaction.description;
};

/**
 * 1. GET FULL HISTORY BY CUSTOMER ID
 * Aggregates all transactions across ALL accounts owned by a single user.
 */
Transaction.getHistoryByCustomer = (customerId, filters, result) => {
  const { type, status, fromDate, toDate } = filters;

  let query = `
    SELECT * FROM (
      /* General Ledger Transactions */
      SELECT t.transaction_id AS id, t.created_at AS date, t.transaction_type AS type, 
             t.amount, 'completed' AS status, t.description, a.account_number
      FROM transactions t
      JOIN accounts a ON t.account_id = a.account_id
      WHERE a.customer_id = ?

      UNION ALL

      /* M-Pesa Transactions */
      SELECT m.mpesa_id AS id, m.created_at AS date, 'deposit' AS type, 
             m.amount, m.status, CONCAT('M-Pesa: ', m.phone_number) AS description, a.account_number
      FROM mpesa_transactions m
      JOIN accounts a ON m.account_id = a.account_id
      WHERE a.customer_id = ?

      UNION ALL

      /* Internal & P2P Transfers */
      SELECT tr.transfer_id AS id, tr.created_at AS date, 'transfer' AS type, 
             CASE WHEN a1.customer_id = ? THEN -tr.amount ELSE tr.amount END AS amount, 
             tr.status, 
             CASE WHEN a1.customer_id = ? THEN 'Transfer Out' ELSE 'Transfer In' END AS description,
             a1.account_number
      FROM transfers tr
      JOIN accounts a1 ON tr.from_account = a1.account_id
      JOIN accounts a2 ON tr.to_account = a2.account_id
      WHERE a1.customer_id = ? OR a2.customer_id = ?
    ) AS customer_history
    WHERE 1=1`;

  const params = [customerId, customerId, customerId, customerId, customerId, customerId];

  // Dynamic Filters
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

  query += ` ORDER BY date DESC`;

  sql.query(query, params, (err, res) => {
    if (err) return result(err, null);
    result(null, res);
  });
};

/**
 * 2. GET FILTERED HISTORY BY SINGLE ACCOUNT ID
 */
Transaction.getFilteredHistoryByAccount = (accountId, filters, result) => {
  const { type, status, fromDate, toDate, minAmount, maxAmount } = filters;

  let query = `
    SELECT * FROM (
      SELECT transaction_id AS id, created_at AS date, transaction_type AS type, 
             amount, 'completed' AS status, description
      FROM transactions WHERE account_id = ?

      UNION ALL

      SELECT mpesa_id AS id, created_at AS date, 'deposit' AS type, 
             amount, status, CONCAT('M-Pesa: ', phone_number) AS description
      FROM mpesa_transactions WHERE account_id = ?

      UNION ALL

      SELECT transfer_id AS id, created_at AS date, 'transfer' AS type, 
             amount, status, 
             CASE WHEN from_account = ? THEN 'Transfer Out' ELSE 'Transfer In' END AS description
      FROM transfers WHERE from_account = ? OR to_account = ?
    ) AS history
    WHERE 1=1`;

  const params = [accountId, accountId, accountId, accountId, accountId];

  if (type && type !== 'all') { query += ` AND type = ?`; params.push(type); }
  if (status && status !== 'all') { query += ` AND status = ?`; params.push(status); }
  if (fromDate) { query += ` AND date >= ?`; params.push(`${fromDate} 00:00:00`); }
  if (toDate) { query += ` AND date <= ?`; params.push(`${toDate} 23:59:59`); }
  if (minAmount) { query += ` AND amount >= ?`; params.push(minAmount); }
  if (maxAmount) { query += ` AND amount <= ?`; params.push(maxAmount); }

  query += ` ORDER BY date DESC`;

  sql.query(query, params, (err, res) => {
    if (err) return result(err, null);
    result(null, res);
  });
};

/**
 * 3. ADMIN: GET ALL TRANSACTIONS GLOBALLY
 */
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
  if (type && type !== 'all') { query += ` AND type = ?`; params.push(type); }
  if (status && status !== 'all') { query += ` AND status = ?`; params.push(status); }
  if (fromDate) { query += ` AND date >= ?`; params.push(`${fromDate} 00:00:00`); }
  if (toDate) { query += ` AND date <= ?`; params.push(`${toDate} 23:59:59`); }
  if (minAmount) { query += ` AND amount >= ?`; params.push(minAmount); }
  if (maxAmount) { query += ` AND amount <= ?`; params.push(maxAmount); }

  query += ` ORDER BY date DESC`;

  sql.query(query, params, (err, res) => {
    if (err) return result(err, null);
    result(null, res);
  });
};

// GET TOTAL COUNT
Transaction.countAll = (result) => {
  sql.query("SELECT COUNT(*) AS total FROM transactions", (err, res) => {
    if (err) return result(err, null);
    result(null, res[0].total || 0);
  });
};

// GET TOTAL VOLUME
Transaction.getTotalVolume = (result) => {
  sql.query("SELECT SUM(amount) AS total_volume FROM transactions", (err, res) => {
    if (err) return result(err, null);
    result(null, res[0].total_volume || 0);
  });
};

// CREATE NEW TRANSACTION
Transaction.create = (newTx, result) => {
  sql.query("INSERT INTO transactions SET ?", newTx, (err, res) => {
    if (err) return result(err, null);
    result(null, { id: res.insertId, ...newTx });
  });
};

// FIND BY ACCOUNT ID
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

// GET RECENT
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


Transaction.getSpendingAnalytics = (customerId, result) => {
  const query = `
    WITH SpendingData AS (
      SELECT * FROM (
        /* 1. Direct Withdrawals/Debits from Ledger */
        SELECT 
          transaction_type AS category, 
          ABS(amount) AS amount
        FROM transactions t
        JOIN accounts a ON t.account_id = a.account_id
        WHERE a.customer_id = ? 
        AND (transaction_type IN ('withdrawal', 'payment', 'bill_pay') OR amount < 0)

        UNION ALL

        /* 2. Outgoing Transfers (Money leaving the user's ecosystem) */
        /* We only count transfers WHERE the 'from_account' belongs to the customer 
           AND the 'to_account' belongs to someone ELSE */
        SELECT 
          'transfer' AS category, 
          tr.amount
        FROM transfers tr
        JOIN accounts a1 ON tr.from_account = a1.account_id
        JOIN accounts a2 ON tr.to_account = a2.account_id
        WHERE a1.customer_id = ? AND a2.customer_id != ?
      ) AS all_spending
    ),
    TotalSum AS (
      SELECT SUM(amount) as grand_total FROM SpendingData
    )
    SELECT 
      category, 
      SUM(amount) as amount,
      ROUND((SUM(amount) / (SELECT grand_total FROM TotalSum)) * 100, 2) as percentage
    FROM SpendingData
    GROUP BY category
    HAVING amount > 0;
  `;

  // We pass customerId three times for the CTE logic
  sql.query(query, [customerId, customerId, customerId], (err, res) => {
    if (err) {
      console.error("Error fetching analytics:", err);
      return result(err, null);
    }
    
    // Format response to match the React Component's expectations
    // Mapping DB types to readable UI categories if necessary
    const formattedData = res.map(row => ({
      category: row.category.charAt(0).toUpperCase() + row.category.slice(1),
      amount: parseFloat(row.amount),
      percentage: parseFloat(row.percentage)
    }));

    result(null, formattedData);
  });
};

Transaction.getSpendingByCategories = (customerId, result) => {
  const query = `
    SELECT 
      transaction_type as category, 
      SUM(ABS(amount)) as total_amount,
      COUNT(*) as transaction_count
    FROM transactions t
    JOIN accounts a ON t.account_id = a.account_id
    WHERE a.customer_id = ? AND t.amount < 0
    GROUP BY transaction_type`;
    
  // Use 'sql' because that is what you required at the top: const sql = require('./db.js');
  sql.query(query, [customerId], (err, res) => {
    if (err) {
      return result(err, null);
    }
    result(null, res);
  });
};


Transaction.getMonthlyTrends = (customerId, result) => {
  const query = `
    SELECT 
       DATE_FORMAT(t.created_at, '%b') as month,
       SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as income,
       SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as expenses
      FROM transactions t
      JOIN accounts a ON t.account_id = a.account_id
      WHERE a.customer_id = ?
      GROUP BY month, DATE_FORMAT(t.created_at, '%Y-%m')
      ORDER BY DATE_FORMAT(t.created_at, '%Y-%m') DESC
      LIMIT 6`;

  sql.query(query, [customerId], (err, res) => {
    if (err) return result(err, null);
    result(null, res.reverse()); // Reverse to show Jan -> Mar order
  });
};


Transaction.getBudgetAnalytics = (customerId, result) => {
  const query = `
    SELECT 
      a.account_type as category,
      a.balance as current_balance,
      COALESCE(SUM(ABS(t.amount)), 0) as spent
    FROM accounts a
    LEFT JOIN transactions t ON a.account_id = t.account_id 
      AND t.amount < 0 
      AND MONTH(t.created_at) = MONTH(CURRENT_DATE())
      AND YEAR(t.created_at) = YEAR(CURRENT_DATE())
    WHERE a.customer_id = ?
    GROUP BY a.account_id`;

  sql.query(query, [customerId], (err, res) => {
    if (err) return result(err, null);
    result(null, res);
  });
};

module.exports = Transaction;