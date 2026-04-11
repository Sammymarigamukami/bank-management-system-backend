const FixedDepositModel = require("../models/fixedDepositModel.js");
const db = require("../models/db"); 

/**
 * FIXED DEPOSIT CONTROLLER
 * Manages the lifecycle of FD accounts, including creation and collateral verification.
 */

/**
 * 1. OPEN NEW FIXED DEPOSIT
 * Expects: { accountId, amount, durationMonths, interestRate }
 */
exports.createFD = (req, res) => {
  const customerId = req.user?.customer_id; // From Auth Middleware
  const { accountId, amount, durationMonths, interestRate } = req.body;

  // Validation
  if (!accountId || !amount || !durationMonths || !interestRate) {
    return res.status(400).json({ 
      success: false, 
      message: "Please provide account, amount, duration, and interest rate." 
    });
  }

  const fdData = {
    customer_id: customerId,
    account_id: accountId,
    amount: parseFloat(amount),
    durationMonths: parseInt(durationMonths),
    interestRate: parseFloat(interestRate)
  };

  FixedDepositModel.create(fdData, (err, result) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: err.message || "Failed to create Fixed Deposit." 
      });
    }

    res.status(201).json({
      success: true,
      message: "Fixed Deposit activated successfully.",
      data: result
    });
  });
};

/**
 * 2. GET ELIGIBLE COLLATERAL
 * Fetches FDs that can be used to secure an online loan.
 */

exports.getEligibleFDs = (req, res) => {
  const customerId = req.user?.customer_id;

  FixedDepositModel.getEligibleCollateral(customerId, (err, rows) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Error fetching eligible collateral." 
      });
    }

    res.status(200).json({
      success: true,
      data: rows
    });
  });
};

/**
 * 3. GET CUSTOMER FD PORTFOLIO
 * Returns all FDs (active, matured, or collateralized) for the logged-in user.
 */
exports.getMyFDs = (req, res) => {
  const customerId = req.user?.customer_id;

  const sql = `
    SELECT fd.*, a.account_number as source_account 
    FROM fd_accounts fd
    JOIN accounts a ON fd.account_id = a.account_id
    WHERE fd.customer_id = ?
    ORDER BY fd.created_at DESC`;

  db.query(sql, [customerId], (err, rows) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: "Error fetching FD portfolio." 
      });
    }

    res.status(200).json({
      success: true,
      data: rows
    });
  });
};

/**
 * 4. GET FD DETAILS
 * Fetches specific details of a single FD.
 */
exports.getFDDetails = (req, res) => {
  const customerId = req.user?.customer_id;
  const { id } = req.params;

  const sql = "SELECT * FROM fd_accounts WHERE fd_id = ? AND customer_id = ?";
  db.query(sql, [id, customerId], (err, rows) => {
    if (err || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Fixed Deposit not found." });
    }
    res.status(200).json({ success: true, data: rows[0] });
  });
};