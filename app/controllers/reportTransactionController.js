const db = require("../models/db");
const { createObjectCsvStringifier } = require("csv-writer");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

/**
 * ADMINISTRATIVE TRANSACTION REPORT CONTROLLER
 * Handles high-level generation of CSV, PDF, and EXCEL reports for bank auditing.
 */

const TransactionReportController = {
  /**
   * Helper: Formats raw database rows into a structured CSV string
   */
  async generateCSV(records) {
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'transaction_id', title: 'TX_ID' },
        { id: 'created_at', title: 'TIMESTAMP' },
        { id: 'account_number', title: 'ACCOUNT_NO' },
        { id: 'customer_name', title: 'CUSTOMER_NAME' },
        { id: 'transaction_type', title: 'TYPE' },
        { id: 'amount', title: 'AMOUNT' },
        { id: 'balance_after', title: 'POST_BALANCE' },
        { id: 'reference_code', title: 'REFERENCE' },
        { id: 'description', title: 'DESCRIPTION' },
      ]
    });

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  },

  /**
   * Helper: Generates a professional Excel (.xlsx) file
   */
  async generateExcel(res, records, title) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Transactions");

    // Define Columns aligned with the SQL table
    worksheet.columns = [
      { header: "TX ID", key: "transaction_id", width: 10 },
      { header: "Timestamp", key: "created_at", width: 25 },
      { header: "Account No", key: "account_number", width: 20 },
      { header: "Customer Name", key: "customer_name", width: 25 },
      { header: "Type", key: "transaction_type", width: 15 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Post Balance", key: "balance_after", width: 15 },
      { header: "Reference", key: "reference_code", width: 20 },
      { header: "Description", key: "description", width: 35 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    records.forEach(row => {
      worksheet.addRow({
        ...row,
        created_at: new Date(row.created_at).toLocaleString()
      });
    });

    worksheet.getColumn('amount').numFmt = '#,##0.00';
    worksheet.getColumn('balance_after').numFmt = '#,##0.00';

    const fileName = `${title.replace(/\s+/g, '_')}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
    res.end();
  },

  /**
   * Helper: Generates a PDF report (Landscape recommended for many columns)
   */
  generatePDF(res, records, title) {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${title.replace(/\s+/g, '_')}.pdf`);

    doc.pipe(res);

    doc.fontSize(20).text("Nexus Bank - Administrative Audit Report", { align: "center" });
    doc.fontSize(12).text(title, { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: "right" });
    doc.moveDown();

    const tableTop = 150;
    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("ID", 30, tableTop);
    doc.text("Date", 60, tableTop);
    doc.text("Account", 140, tableTop);
    doc.text("Customer", 240, tableTop);
    doc.text("Type", 360, tableTop);
    doc.text("Amount", 430, tableTop);
    doc.text("Post Bal", 500, tableTop);
    doc.text("Reference", 580, tableTop);
    doc.text("Description", 680, tableTop);
    
    doc.moveTo(30, tableTop + 15).lineTo(780, tableTop + 15).stroke();

    let y = tableTop + 25;
    doc.font("Helvetica");

    records.forEach((row) => {
      if (y > 520) {
        doc.addPage({ layout: 'landscape' });
        y = 50;
      }
      doc.text(row.transaction_id.toString(), 30, y);
      doc.text(new Date(row.created_at).toLocaleDateString(), 60, y);
      doc.text(row.account_number, 140, y);
      doc.text(row.customer_name.substring(0, 20), 240, y);
      doc.text(row.transaction_type.toUpperCase(), 360, y);
      doc.text(row.amount.toString(), 430, y);
      doc.text(row.balance_after ? row.balance_after.toString() : '-', 500, y);
      doc.text(row.reference_code || '-', 580, y);
      doc.text((row.description || '').substring(0, 25), 680, y);
      y += 18;
    });

    doc.end();
  },

  /**
   * Universal Handler for Output Formats
   */
  async handleResponse(res, rows, format, title, csvFileName) {
    const fmt = format.toLowerCase();
    
    if (fmt === 'pdf') {
      return TransactionReportController.generatePDF(res, rows, title);
    } 
    
    if (fmt === 'excel' || fmt === 'xlsx') {
      try {
        return await TransactionReportController.generateExcel(res, rows, title);
      } catch (err) {
        return res.status(500).json({ success: false, message: "Error generating Excel file." });
      }
    }

    try {
      const csvData = await TransactionReportController.generateCSV(rows);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=${csvFileName}.csv`);
      res.status(200).send(csvData);
    } catch (csvErr) {
      res.status(500).json({ success: false, message: "Error generating CSV file." });
    }
  },

  /**
   * FLEXIBLE REPORT HANDLER
   * GET /api/admin/reports/transactions?period=today|week|month|quarter|custom&format=pdf|csv|excel
   */
  downloadAdminReport: (req, res) => {
    // Auth Check
    if (req.user?.role !== 'employee' && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Unauthorized access." });
    }

    const { period = 'today', format = 'csv', startDate, endDate } = req.query;
    
    let dateCondition = "";
    let params = [];
    let title = "Transaction Report";
    let fileName = "BANK_REPORT";

    const now = new Date();

    switch (period) {
      case 'today':
        dateCondition = "DATE(t.created_at) = CURDATE()";
        title = "Daily Report - " + now.toDateString();
        fileName = "DAILY_" + now.toISOString().split('T')[0];
        break;
      case 'week':
        dateCondition = "t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        title = "Weekly Summary Report";
        fileName = "WEEKLY_" + now.toISOString().split('T')[0];
        break;
      case 'month':
        dateCondition = "t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        title = "Monthly Audit Report";
        fileName = "MONTHLY_" + now.toISOString().split('T')[0];
        break;
      case 'quarter':
        dateCondition = "t.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)";
        title = "Quarterly Transaction Review";
        fileName = "QUARTERLY_" + now.toISOString().split('T')[0];
        break;
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ success: false, message: "Start and end dates required for custom range." });
        }
        dateCondition = "DATE(t.created_at) BETWEEN ? AND ?";
        params = [startDate, endDate];
        title = `Report from ${startDate} to ${endDate}`;
        fileName = `RANGE_${startDate}_TO_${endDate}`;
        break;
      default:
        dateCondition = "DATE(t.created_at) = CURDATE()";
    }

    const sql = `
      SELECT t.transaction_id, t.transaction_type, t.amount, t.balance_after, 
             t.reference_code, t.description, t.created_at,
             a.account_number, CONCAT(c.first_name, ' ', c.last_name) as customer_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.account_id
      JOIN customers c ON a.customer_id = c.customer_id
      WHERE ${dateCondition}
      ORDER BY t.created_at DESC`;

    db.query(sql, params, async (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Database error." });
      }
      if (rows.length === 0) return res.status(404).json({ success: false, message: "No activity found for this period." });

      await TransactionReportController.handleResponse(res, rows, format, title, fileName);
    });
  }
};

module.exports = TransactionReportController;