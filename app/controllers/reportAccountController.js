const db = require("../models/db");
const { createObjectCsvStringifier } = require("csv-writer");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

/**
 * ACCOUNT REPORT CONTROLLER
 * Handles reporting for all account types (Savings, Business, Current).
 */

const AccountReportController = {
  /**
   * Helper: CSV Formatting
   */
  async generateAccountCSV(records) {
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'account_number', title: 'ACCOUNT_NUMBER' },
        { id: 'holder_name', title: 'HOLDER_NAME' },
        { id: 'account_type', title: 'TYPE' },
        { id: 'balance', title: 'BALANCE' },
        { id: 'currency', title: 'CURRENCY' },
        { id: 'created_at', title: 'OPENED_DATE' },
        { id: 'status', title: 'STATUS' },
      ]
    });
    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  },

  /**
   * Helper: PDF Generation
   */
  generateAccountPDF(res, records, title) {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Account_Report.pdf`);

    doc.pipe(res);
    doc.fontSize(18).text("Apex Bank - Account & Balance Summary", { align: "center" });
    doc.fontSize(11).text(title, { align: "center" });
    doc.moveDown();

    const tableTop = 120;
    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("Acc Number", 30, tableTop);
    doc.text("Account Holder", 130, tableTop);
    doc.text("Type", 300, tableTop);
    doc.text("Balance", 400, tableTop);
    doc.text("Date Opened", 500, tableTop);
    doc.text("Status", 650, tableTop);
    
    doc.moveTo(30, tableTop + 12).lineTo(750, tableTop + 12).stroke();

    let y = tableTop + 20;
    doc.font("Helvetica");

    records.forEach((acc) => {
      if (y > 500) { doc.addPage({ layout: 'landscape' }); y = 50; }
      
      doc.text(acc.account_number, 30, y);
      doc.text(acc.holder_name, 130, y);
      doc.text(acc.account_type.toUpperCase(), 300, y);
      doc.text(`${acc.currency} ${parseFloat(acc.balance).toLocaleString()}`, 400, y);
      doc.text(new Date(acc.created_at).toLocaleDateString(), 500, y);
      doc.text(acc.status || 'Active', 650, y);
      y += 18;
    });

    doc.end();
  },

  /**
   * Helper: Excel Generation
   */
  async generateAccountExcel(res, records, title) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Accounts");

    worksheet.columns = [
      { header: "Account Number", key: "account_number", width: 20 },
      { header: "Holder Name", key: "holder_name", width: 25 },
      { header: "Type", key: "account_type", width: 15 },
      { header: "Balance", key: "balance", width: 15 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Status", key: "status", width: 15 },
      { header: "Created At", key: "created_at", width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } }; // Green-800

    records.forEach(acc => {
      worksheet.addRow({
        ...acc,
        balance: parseFloat(acc.balance),
        created_at: new Date(acc.created_at).toLocaleDateString()
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Accounts_Export.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  },

  /**
   * GET /api/admin/reports/accounts
   * Query Params: format, period, startDate, endDate, type (savings|business|current)
   */
  downloadAccountList: (req, res) => {
    // Admin check logic here...
    
    const { format = 'csv', period = 'all', startDate, endDate, type } = req.query;
    
    let filters = [];
    let queryParams = [];
    let periodTitle = "Comprehensive Account Report";

    // 1. Account Type Filter
    if (type) {
      filters.push("a.account_type = ?");
      queryParams.push(type);
    }

    // 2. Date Period Logic
    switch (period.toLowerCase()) {
      case 'today':
        filters.push("DATE(a.created_at) = CURDATE()");
        periodTitle += " - Today";
        break;
      case 'week':
        filters.push("a.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
        periodTitle += " - Past 7 Days";
        break;
      case 'month':
        filters.push("a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
        periodTitle += " - Past 30 Days";
        break;
      case 'quarter':
        filters.push("a.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)");
        periodTitle += " - Past Quarter";
        break;
      case 'custom':
        if (startDate && endDate) {
          filters.push("DATE(a.created_at) BETWEEN ? AND ?");
          queryParams.push(startDate, endDate);
          periodTitle += ` (${startDate} to ${endDate})`;
        }
        break;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const sql = `
      SELECT 
        a.account_number, 
        CONCAT(c.first_name, ' ', c.last_name) AS holder_name,
        a.account_type, 
        a.balance, 
        a.currency, 
        a.created_at, 
        a.status
      FROM accounts a
      JOIN customers c ON a.customer_id = c.customer_id
      ${whereClause}
      ORDER BY a.created_at DESC`;

    db.query(sql, queryParams, async (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Query error" });
      if (rows.length === 0) return res.status(404).json({ success: false, message: "No accounts found" });

      const fmt = format.toLowerCase();
      
      if (fmt === 'pdf') return AccountReportController.generateAccountPDF(res, rows, periodTitle);
      
      if (fmt === 'excel' || fmt === 'xlsx') {
        return await AccountReportController.generateAccountExcel(res, rows, periodTitle);
      }

      // Default CSV
      const csvData = await AccountReportController.generateAccountCSV(rows);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=Accounts.csv");
      res.send(csvData);
    });
  }
};

module.exports = AccountReportController;
