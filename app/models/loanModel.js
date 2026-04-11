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
}

/**
 * OnlineLoanModel handles digital loans backed by Fixed Deposits (FD)
 */
class OnlineLoanModel {
  /**
   * Triggers the 'apply_for_online_loan' Stored Procedure
   * This procedure handles collateral check, disbursement, and status updates atomically
   */
  static apply(loanData, callback) {
    const { customerId, fdId, savingsId, loanTypeId, amount, duration } = loanData;
    
    // Calling the MySQL Stored Procedure
    const sql = "CALL apply_for_online_loan(?, ?, ?, ?, ?, ?, @p_status_code)";
    
    db.query(sql, [customerId, fdId, savingsId, loanTypeId, amount, duration], (err) => {
        console.log("Stored Procedure executed with params:", { customerId, fdId, savingsId, loanTypeId, amount, duration });
      if (err) {
        console.error("Error executing stored procedure:", err);
        return callback(err);
      }
      
      // Retrieve the output status code from the procedure
      db.query("SELECT @p_status_code AS status", (err, rows) => {
        console.log("Stored Procedure output status:", rows);
        if (err) return callback(err);
        const status = rows[0].status;
        
        if (status === 'SUCCESS') {
          callback(null, { success: true, message: "Loan disbursed successfully" });
        } else {
          callback(new Error(status));
        }
      });
    });
  }

  static getCustomerLoans(customerId, callback) {
    const sql = `
      SELECT ol.*, lt.type_name, a.account_number as disbursed_to 
      FROM online_loans ol
      JOIN loan_types lt ON ol.loan_type_id = lt.loan_type_id
      JOIN accounts a ON ol.savings_account_id = a.account_id
      WHERE ol.customer_id = ?`;
    db.query(sql, [customerId], callback);
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

/**
 * FixedDepositModel handles FD lifecycle and collateral status
 */
class FixedDepositModel {
  static getEligibleCollateral(customerId, callback) {
    const sql = "SELECT * FROM fd_accounts WHERE customer_id = ? AND status = 'active'";
    db.query(sql, [customerId], callback);
  }

  static getById(fdId, callback) {
    const sql = "SELECT * FROM fd_accounts WHERE fd_id = ?";
    db.query(sql, [fdId], (err, rows) => callback(err, rows[0]));
  }
}

module.exports = {
  LoanTypeModel,
  OnlineLoanModel,
  PhysicalLoanModel,
  InstallmentModel,
  FixedDepositModel
};