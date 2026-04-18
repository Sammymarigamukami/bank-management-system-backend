const db = require("./db.js");

class LoanTypeModel {
  /**
   * 1. Create a New Loan Type
   * Used by admins to define new financial products.
   */
  static create(data, callback) {
    const { 
      type_name, 
      base_interest_rate, 
      max_duration_months, 
      min_amount, 
      max_amount, 
      is_online 
    } = data;

    const sql = `
      INSERT INTO loan_types 
      (type_name, base_interest_rate, max_duration_months, min_amount, max_amount, is_online) 
      VALUES (?, ?, ?, ?, ?, ?)`;

    db.query(
      sql, 
      [type_name, base_interest_rate, max_duration_months, min_amount, max_amount, is_online || true], 
      (err, result) => {
        if (err) return callback(err);
        callback(null, { loan_type_id: result.insertId, ...data });
      }
    );
  }

  /**
   * 2. Get All Loan Types
   * Frequently used to populate dropdowns in the loan application UI.
   */
  static getAll(callback) {
    const sql = "SELECT * FROM loan_types ORDER BY type_name ASC";
    db.query(sql, callback);
  }

  /**
   * 3. Get Online Loans Only
   * Specifically for the mobile/web banking "Instant Loan" feature.
   */
  static getOnlineLoans(callback) {
    const sql = "SELECT * FROM loan_types WHERE is_online = TRUE";
    db.query(sql, callback);
  }

  /**
   * 4. Get Single Loan Type Details
   * Fetches constraints like interest rates and max amounts for a specific product.
   */
  static getById(id, callback) {
    const sql = "SELECT * FROM loan_types WHERE loan_type_id = ?";
    db.query(sql, [id], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0] || null);
    });
  }

  /**
   * 5. Update Loan Configuration
   * Allows adjusting interest rates or limits based on market conditions.
   */
  static update(id, data, callback) {
    const { 
      type_name, 
      base_interest_rate, 
      max_duration_months, 
      min_amount, 
      max_amount 
    } = data;

    const sql = `
      UPDATE loan_types 
      SET type_name = ?, base_interest_rate = ?, max_duration_months = ?, 
          min_amount = ?, max_amount = ? 
      WHERE loan_type_id = ?`;

    db.query(
      sql, 
      [type_name, base_interest_rate, max_duration_months, min_amount, max_amount, id], 
      callback
    );
  }

  /**
   * 6. Validation Helper
   * Checks if a requested loan amount and duration fit within the product's rules.
   */
  static validateApplication(loanTypeId, amount, duration, callback) {
    this.getById(loanTypeId, (err, loanType) => {
      if (err || !loanType) return callback(err || new Error("Invalid loan type"));

      const errors = [];
      if (amount < loanType.min_amount) errors.push(`Minimum amount is ${loanType.min_amount}`);
      if (amount > loanType.max_amount) errors.push(`Maximum amount is ${loanType.max_amount}`);
      if (duration > loanType.max_duration_months) errors.push(`Maximum duration is ${loanType.max_duration_months} months`);

      if (errors.length > 0) {
        return callback(new Error(errors.join(". ")));
      }

      callback(null, loanType);
    });
  }

  static toggleOnlineStatus(id, isOnline, callback) {
    const sql = "UPDATE loan_types SET is_online = ? WHERE loan_type_id = ?";
    db.query(sql, [isOnline, id], callback);
  }

  static delete(id, callback) {
    const sql = "DELETE FROM loan_types WHERE loan_type_id = ?";
    db.query(sql, [id], callback);
  }
}

/**
 * OnlineLoanModel handles digital loans backed by Fixed Deposits (FD)
 */
class OnlineLoanModel {
  /**
   * Creates a new loan application record in the database.
   * Handles the initial 'pending' state.
   */
  static apply(loanData, callback) {
    const {
      customerId,
      loanTypeId,
      amount,
      duration,
      interestRate,
      purpose,
      employmentStatus,
      monthlyIncome,
      idDocUrl,
      bankStmtUrl
    } = loanData;

    // Removed fd_account_id and savings_account_id
    const sql = `
      INSERT INTO online_loans (
        customer_id, 
        loan_type_id, 
        amount, 
        duration_months, 
        interest_rate, 
        purpose, 
        employment_status, 
        monthly_income, 
        id_doc_url, 
        bank_stmt_url,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    const params = [
      customerId,
      loanTypeId,
      amount,
      duration,
      interestRate,
      purpose,
      employmentStatus,
      monthlyIncome,
      idDocUrl || null,
      bankStmtUrl || null
    ];

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error("Database error during loan application:", err);
        return callback(err);
      }
      
      callback(null, { 
        success: true, 
        insertId: result.insertId,
        message: "Loan application submitted successfully and is pending review." 
      });
    });
  }

  /**
   * Retrieves all loans for a specific customer.
   * Updated to remove dependencies on account IDs.
   */
  static getCustomerLoans(customerId, callback) {
    const sql = `
      SELECT 
        ol.loan_id,
        ol.amount,
        ol.duration_months,
        ol.interest_rate,
        ol.purpose,
        ol.employment_status,
        ol.monthly_income,
        ol.status,
        ol.id_doc_url,
        ol.bank_stmt_url,
        ol.created_at,
        lt.type_name
      FROM online_loans ol
      JOIN loan_types lt ON ol.loan_type_id = lt.loan_type_id
      WHERE ol.customer_id = ?
      ORDER BY ol.created_at DESC`;

    db.query(sql, [customerId], (err, results) => {
      if (err) {
        console.error("Error fetching customer loans:", err);
        return callback(err);
      }
      callback(null, results);
    });
  }

    /**
   * Retrieves all loans for administrative review.
   * Includes customer names and loan type details.
   */
  static getAllLoans(callback) {
    const sql = `
      SELECT 
        ol.loan_id,
        ol.customer_id,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        c.email AS customer_email,
        lt.type_name AS loan_type,
        ol.amount,
        ol.duration_months,
        ol.interest_rate,
        ol.purpose,
        ol.status,
        ol.employment_status,
        ol.monthly_income,
        ol.id_doc_url,
        ol.bank_stmt_url,
        ol.created_at,
        ol.updated_at
      FROM online_loans ol
      JOIN customers c ON ol.customer_id = c.customer_id
      JOIN loan_types lt ON ol.loan_type_id = lt.loan_type_id
      ORDER BY ol.created_at DESC
    `;

    db.query(sql, (err, results) => {
      if (err) {
        console.error("Error fetching all loans for admin:", err);
        return callback(err);
      }
      callback(null, results);
    });
  }

  /**
   * Static method to fetch a single loan by ID
   */
  static getLoanById(loanId, callback) {
    const sql = `SELECT * FROM online_loans WHERE loan_id = ?`;
    db.query(sql, [loanId], (err, results) => {
      if (err) return callback(err);
      callback(null, results[0]);
    });
  }
}

/**
 * PhysicalLoanModel handles branch-processed loans requiring approval
 */
class PhysicalLoanModel {
  static request(loanData, callback) {
    const { customerId, branchId, employeeId, savingsId, loanTypeId, amount, duration, interestRate } = loanData;
    const sql = `
      INSERT INTO physical_loans 
      (customer_id, branch_id, employee_id, savings_account_id, loan_type_id, amount, duration_months, interest_rate, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`;
    
    db.query(sql, [customerId, branchId, employeeId, savingsId, loanTypeId, amount, duration, interestRate], callback);
  }

  static approve(loanId, callback) {
    // Updating 'is_approved' triggers 'trg_after_physical_loan_approval' in the DB
    const sql = "UPDATE physical_loans SET is_approved = TRUE, approval_date = NOW(), status = 'active' WHERE loan_id = ?";
    db.query(sql, [loanId], callback);
  }
}

/**
 * InstallmentModel handles repayment logic for both loan types
 */
class InstallmentModel {
  static getPendingByLoan(loanId, type, callback) {
    const table = type === 'online' ? 'online_loan_installments' : 'physical_loan_installments';
    const sql = `SELECT * FROM ${table} WHERE loan_id = ? AND status != 'paid' ORDER BY due_date ASC`;
    db.query(sql, [loanId], callback);
  }

  /**
   * Triggers the 'pay_online_installment' Stored Procedure
   */
  static payOnlineInstallment(installmentId, callback) {
    const sql = "CALL pay_online_installment(?, @p_status_code)";
    
    db.query(sql, [installmentId], (err) => {
      if (err) return callback(err);
      
      db.query("SELECT @p_status_code AS status", (err, rows) => {
        if (err) return callback(err);
        const status = rows[0].status;
        
        if (status === 'SUCCESS') {
          callback(null, { success: true });
        } else {
          callback(new Error(status));
        }
      });
    });
  }
}

module.exports = {
  LoanTypeModel,
  OnlineLoanModel,
  PhysicalLoanModel,
  InstallmentModel,
};