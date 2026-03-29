const sql = require('./db.js');

const FinancialStats = function() {};

FinancialStats.getGlobalTotals = (result) => {
 
  const query = `
    SELECT 
      (SELECT COUNT(*) FROM transactions) AS total_ledger_count,
      (SELECT SUM(amount) FROM transactions WHERE transaction_type = 'deposit') AS total_ledger_deposits,
      (SELECT SUM(amount) FROM transactions WHERE transaction_type = 'withdrawal') AS total_ledger_withdrawals,
      (SELECT COUNT(*) FROM mpesa_transactions) AS total_mpesa_attempts,
      (SELECT COUNT(*) FROM mpesa_transactions WHERE status = 'completed') AS total_mpesa_success_count,
      (SELECT SUM(amount) FROM mpesa_transactions WHERE status = 'completed') AS total_mpesa_value
  `;

  sql.query(query, (err, res) => {
    if (err) {
      console.log("error: ", err);
      result(err, null);
      return;
    }

    // Standardizing the output for the frontend
    const stats = {
      ledger: {
        count: res[0].total_ledger_count || 0,
        deposits: res[0].total_ledger_deposits || 0,
        withdrawals: res[0].total_ledger_withdrawals || 0
      },
      mpesa: {
        attempts: res[0].total_mpesa_attempts || 0,
        successCount: res[0].total_mpesa_success_count || 0,
        totalValue: res[0].total_mpesa_value || 0
      }
    };

    result(null, stats);
  });
};


FinancialStats.getAllJoinedHistory = (result) => {

  const query = `
    SELECT 
      t.transaction_id,
      t.account_id,
      t.transaction_type,
      t.amount,
      t.balance_after,
      t.created_at,
      m.mpesa_code,
      m.phone_number,
      m.status AS mpesa_status,
      m.reference_code AS stk_order_id
    FROM transactions t
    LEFT JOIN mpesa_transactions m ON t.reference_code = m.mpesa_code
    ORDER BY t.created_at DESC
  `;

  sql.query(query, (err, res) => {
    if (err) {
      console.log("error: ", err);
      result(err, null);
      return;
    }
    result(null, res);
  });
};

FinancialStats.getActiveAccountsReport = (result) => {
  const query = `
    SELECT 
      c.customer_id as customerId,           
      a.account_number as accountNumber,
      CONCAT(c.first_name, ' ', c.last_name) as holderName,
      a.account_type as type,
      a.balance,
      a.status,
      (SELECT MAX(created_at) FROM transactions 
       WHERE account_id = a.account_id) as lastActivity
    FROM accounts a
    JOIN customers c ON a.customer_id = c.customer_id
    WHERE a.status = 'active'
  `;

  sql.query(query, (err, res) => {
    if (err) {
      console.error("Error fetching account report:", err);
      result(err, null);
      return;
    }

    const report = res.map(row => ({
      ...row,
      // Since we used '...row', customerId is already included, 
      // but we ensure clean formatting for the other fields here:
      balance: parseFloat(row.balance || 0).toFixed(2),
      lastActivity: row.lastActivity 
        ? new Date(row.lastActivity).toLocaleString('en-KE') 
        : "No activity yet"
    }));

    result(null, report);
  });
};

module.exports = FinancialStats;