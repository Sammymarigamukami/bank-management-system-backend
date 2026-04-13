const db = require("../models/db.js");
const { createObjectCsvStringifier } = require("csv-writer");

/**
 * ADMINISTRATIVE TRANSACTION REPORT CONTROLLER
 * Handles high-level generation of CSV reports for bank auditing, 
 * reconciliation, and global transaction monitoring.
 */

const TransactionReportController = {
  /**
   * Helper: Formats raw database rows into a structured CSV string
   */
  async generateCSV(records) {
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'id', title: 'TX_ID' },
        { id: 'created_at', title: 'TIMESTAMP' },
        { id: 'account_number', title: 'ACCOUNT_NO' },
        { id: 'customer_name', title: 'CUSTOMER_NAME' },
        { id: 'transaction_type', title: 'TYPE' },
        { id: 'amount', title: 'AMOUNT' },
        { id: 'reference_code', title: 'REFERENCE' },
        { id: 'status', title: 'STATUS' },
        { id: 'description', title: 'DESCRIPTION' },
      ]
    });

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  },

  /**
   * GET /api/admin/reports/daily?date=YYYY-MM-DD
   * Admin tool to download every transaction that occurred in the bank on a specific day.
   */
  downloadDailyAdminReport: (req, res) => {
    // SECURITY CHECK: Ensure the user is an admin (logic handled by your middleware)
    if (req.user?.role !== 'employee') {
      return res.status(403).json({ success: false, message: "Unauthorized access." });
    }

    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: "Date is required." });
    }

    const sql = `
      SELECT 
        t.*, 
        a.account_number, 
        CONCAT(c.first_name, ' ', c.last_name) as customer_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.account_id
      JOIN customers c ON a.customer_id = c.customer_id
      WHERE DATE(t.created_at) = ?
      ORDER BY t.created_at DESC`;

    db.query(sql, [date], async (err, rows) => {
      console.log("Daily report query executed for date:", date, "Records found:", rows.length);
      if (err) return res.status(500).json({ success: false, message: "Database query error." });
      
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: "No activity recorded for this date." });
      }

      const csvData = await TransactionReportController.generateCSV(rows);
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=BANK_DAILY_LOG_${date}.csv`);
      res.status(200).send(csvData);
    });
  },

  /**
   * GET /api/admin/reports/monthly?year=2024&month=05&type=withdrawal
   * Generates a monthly reconciliation report, optionally filtered by transaction type.
   */
  downloadMonthlyAdminReport: (req, res) => {
    console.log("Received request for monthly report with query:", req.user);
    if (req.user?.role !== 'employee') {
      return res.status(403).json({ success: false, message: "Unauthorized access." });
    }

    const { year, month, type } = req.query;

    if (!year || !month) {
      return res.status(400).json({ success: false, message: "Year and Month are required." });
    }

    let sql = `
      SELECT 
        t.*, 
        a.account_number, 
        CONCAT(c.first_name, ' ', c.last_name) as customer_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.account_id
      JOIN customers c ON a.customer_id = c.customer_id
      WHERE YEAR(t.created_at) = ? AND MONTH(t.created_at) = ?`;

    const params = [year, month];

    // Optional filtering by type (e.g., 'paybill', 'transfer', 'withdrawal')
    if (type) {
      sql += ` AND t.transaction_type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY t.created_at ASC`;

    db.query(sql, params, async (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Database error." });

      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: "No data found for the selected period." });
      }

      const csvData = await TransactionReportController.generateCSV(rows);
      
      const fileName = `BANK_RECONCILIATION_${year}_${month}${type ? '_' + type : ''}.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      res.status(200).send(csvData);
    });
  }
};

module.exports = TransactionReportController;