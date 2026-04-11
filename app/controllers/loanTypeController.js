const {LoanTypeModel} = require("../models/loanModel");

/**
 * LOAN TYPE CONTROLLER
 * Handles administrative and customer-facing requests for loan product configurations.
 */

/**
 * 1. GET ALL LOAN TYPES
 * Used by admin dashboards to list all products or by customers to browse options.
 */
exports.getAllLoanTypes = (req, res) => {
  LoanTypeModel.getAll((err, rows) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Error retrieving loan types." 
      });
    }
    res.status(200).json({ success: true, data: rows });
  });
};

/**
 * 2. GET ONLINE LOAN TYPES
 * Filters for products available specifically for instant/online application.
 */
exports.getOnlineLoanTypes = (req, res) => {
  LoanTypeModel.getOnlineLoans((err, rows) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Error retrieving online loan products." 
      });
    }
    res.status(200).json({ success: true, data: rows });
  });
};

/**
 * 3. GET SINGLE LOAN TYPE
 * Fetches specific details and constraints for a single loan type ID.
 */
exports.getLoanTypeById = (req, res) => {
  const { id } = req.params;

  LoanTypeModel.getById(id, (err, loanType) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Server error." });
    }
    if (!loanType) {
      return res.status(404).json({ success: false, message: "Loan type not found." });
    }
    res.status(200).json({ success: true, data: loanType });
  });
};

/**
 * 4. CREATE LOAN TYPE (Admin Only)
 * Allows administrators to define new loan products.
 */
exports.createLoanType = (req, res) => {
  const { 
    type_name, 
    base_interest_rate, 
    max_duration_months, 
    min_amount, 
    max_amount, 
    is_online 
  } = req.body;

  // Basic validation
  if (!type_name || !base_interest_rate || !max_duration_months) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing required product configuration fields." 
    });
  }

  const data = { 
    type_name, 
    base_interest_rate, 
    max_duration_months, 
    min_amount: min_amount || 0, 
    max_amount: max_amount || 0, 
    is_online: is_online !== undefined ? is_online : true 
  };

  LoanTypeModel.create(data, (err, result) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Failed to create loan product." 
      });
    }
    res.status(201).json({ 
      success: true, 
      message: "Loan product created successfully.", 
      data: result 
    });
  });
};

/**
 * 5. UPDATE LOAN TYPE (Admin Only)
 * Updates existing loan constraints or rates.
 */
exports.updateLoanType = (req, res) => {
  const { id } = req.params;
  const data = req.body;

  LoanTypeModel.update(id, data, (err) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Failed to update loan product." 
      });
    }
    res.status(200).json({ 
      success: true, 
      message: "Loan configuration updated." 
    });
  });
};

/**
 * 6. VALIDATE LOAN ELIGIBILITY
 * A "pre-flight" check for the UI to see if a user's desired amount/duration is allowed.
 */
exports.checkEligibility = (req, res) => {
  const { loanTypeId, amount, duration } = req.body;

  if (!loanTypeId || !amount || !duration) {
    return res.status(400).json({ success: false, message: "Missing check parameters." });
  }

  LoanTypeModel.validateApplication(loanTypeId, amount, duration, (err, loanType) => {
    if (err) {
      return res.status(400).json({ 
        success: false, 
        eligible: false, 
        message: err.message 
      });
    }

    res.status(200).json({ 
      success: true, 
      eligible: true, 
      message: "Selection matches product constraints.",
      data: {
        estimatedRate: loanType.base_interest_rate,
        maxTerm: loanType.max_duration_months
      }
    });
  });
};