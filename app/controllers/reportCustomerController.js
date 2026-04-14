const db = require("../models/db");
const { createObjectCsvStringifier } = require("csv-writer");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

/**
 * CUSTOMER REPORT CONTROLLER
 * Provides administrative exports for customer data management.
 * Supports CSV, PDF, and EXCEL formats with dynamic date filtering.
 */

const CustomerReportController = {
  /**
   * Helper: Formats customer records into CSV
   */
  async generateCustomerCSV(records) {
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'customer_id', title: 'ID' },
        { id: 'first_name', title: 'FIRST_NAME' },
        { id: 'last_name', title: 'LAST_NAME' },
        { id: 'email', title: 'EMAIL' },
        { id: 'phone', title: 'PHONE' },
        { id: 'created_at', title: 'JOIN_DATE' },
        { id: 'status', title: 'STATUS' },
      ]
    });

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  },

  /**
   * Helper: Generates a Customer List PDF
   */
  generateCustomerPDF(res, records, title) {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${title.replace(/\s+/g, '_')}.pdf`);

    doc.pipe(res);

    doc.fontSize(20).text("Apex Bank - Global Customer Registry", { align: "center" });
    doc.fontSize(12).text(title, { align: "center" });
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(2);

    const tableTop = 140;
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("ID", 30, tableTop);
    doc.text("Name", 70, tableTop);
    doc.text("Email", 180, tableTop);
    doc.text("Phone", 350, tableTop);
    doc.text("Joined", 450, tableTop);
    doc.text("Status", 520, tableTop);
    
    doc.moveTo(30, tableTop + 15).lineTo(560, tableTop + 15).stroke();

    let y = tableTop + 25;
    doc.font("Helvetica");

    records.forEach((customer) => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }
      const fullName = `${customer.first_name} ${customer.last_name}`;
      doc.text(customer.customer_id.toString(), 30, y);
      doc.text(fullName.substring(0, 20), 70, y);
      doc.text(customer.email.substring(0, 25), 180, y);
      doc.text(customer.phone || 'N/A', 350, y);
      doc.text(new Date(customer.created_at).toLocaleDateString(), 450, y);
      doc.text(customer.status || 'Active', 520, y);
      y += 20;
    });

    doc.end();
  },

  /**
   * Helper: Generates a Styled Excel Workbook
   */
  async generateCustomerExcel(res, records, title) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Customers");

    worksheet.columns = [
      { header: "Customer ID", key: "customer_id", width: 15 },
      { header: "First Name", key: "first_name", width: 20 },
      { header: "Last Name", key: "last_name", width: 20 },
      { header: "Email Address", key: "email", width: 30 },
      { header: "Phone Number", key: "phone", width: 20 },
      { header: "Registration Date", key: "created_at", width: 25 },
      { header: "Account Status", key: "status", width: 15 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40AF" },
    };

    records.forEach(customer => {
      worksheet.addRow({
        ...customer,
        created_at: new Date(customer.created_at).toLocaleString()
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${title.replace(/\s+/g, '_')}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  },

  /**
   * GET /api/admin/reports/customers?format=pdf|csv|excel&period=today|week|month|quarter|custom&startDate=...&endDate=...
   */
  downloadCustomerList: (req, res) => {
    if (req.user?.role !== 'employee') {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    const { format = 'csv', period = 'all', startDate, endDate } = req.query;
    
    let dateFilter = "";
    let params = [];
    let periodTitle = "All Time Registry";

    // Date Logic
    switch (period.toLowerCase()) {
      case 'today':
        dateFilter = "WHERE DATE(created_at) = CURDATE()";
        periodTitle = `Today's Registrations (${new Date().toLocaleDateString()})`;
        break;
      case 'week':
        dateFilter = "WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        periodTitle = "Past 7 Days Registrations";
        break;
      case 'month':
        dateFilter = "WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        periodTitle = "Past 30 Days Registrations";
        break;
      case 'quarter':
        dateFilter = "WHERE created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)";
        periodTitle = "Quarterly Registrations (90 Days)";
        break;
      case 'custom':
        if (startDate && endDate) {
          dateFilter = "WHERE DATE(created_at) BETWEEN ? AND ?";
          params = [startDate, endDate];
          periodTitle = `Registrations From ${startDate} To ${endDate}`;
        }
        break;
    }

    const sql = `
      SELECT 
        customer_id, first_name, last_name, email, phone, created_at, 
        'Active' as status 
      FROM customers 
      ${dateFilter}
      ORDER BY created_at DESC`;

    db.query(sql, params, async (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: "Database error." });
      if (rows.length === 0) return res.status(404).json({ success: false, message: "No records found for this period." });

      const fmt = format.toLowerCase();
      const fileName = `Customer_Report_${period}_${new Date().getTime()}`;

      if (fmt === 'pdf') {
        return CustomerReportController.generateCustomerPDF(res, rows, periodTitle);
      } 
      
      if (fmt === 'excel' || fmt === 'xlsx') {
        try {
          return await CustomerReportController.generateCustomerExcel(res, rows, periodTitle);
        } catch (exErr) {
          return res.status(500).json({ success: false, message: "Excel generation failed." });
        }
      }

      // Default CSV
      try {
        const csvData = await CustomerReportController.generateCustomerCSV(rows);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=${fileName}.csv`);
        res.status(200).send(csvData);
      } catch (csvErr) {
        res.status(500).json({ success: false, message: "CSV encoding error." });
      }
    });
  }
};

module.exports = CustomerReportController;