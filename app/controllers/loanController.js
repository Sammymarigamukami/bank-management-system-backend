const { 
  OnlineLoanModel, 
  PhysicalLoanModel, 
  InstallmentModel, 
  LoanTypeModel, 
  FixedDepositModel 
} = require("../models/loanModel");

// Import the configured cloudinary instance from your config file
const { cloudinary } = require('../config/cloudinary'); 
const fs = require('fs'); // Added to clean up temp files

exports.applyForOnlineLoan = async (req, res) => {
    try {
        // Extracting customerId from the authenticated user (jwtauth middleware)
        const customerId = req.user?.customer_id;

        if (!customerId) {
            return res.status(401).json({ success: false, message: "Unauthorized: Customer ID not found." });
        }

        // 1. Destructure only the columns present in your NEW schema
        const {
            loanTypeId,
            amount,
            duration,
            interestRate,
            purpose,
            employmentStatus,
            monthlyIncome
        } = req.body;
        console.log("Received loan application data:", req.body);

        let idDocUrl = null;
        let bankStmtUrl = null;

        // 2. Handle File Uploads to Cloudinary
        if (req.files) {
            // Upload ID Document
            if (req.files.idDocument) {
                const idResult = await cloudinary.uploader.upload(req.files.idDocument[0].path, {
                    folder: 'loan_documents/ids',
                    resource_type: 'auto'
                });
                idDocUrl = idResult.secure_url;
                console.log("ID Document uploaded to Cloudinary:", idDocUrl);
                
                // Remove local file after successful upload
                fs.unlinkSync(req.files.idDocument[0].path);
            }

            // Upload Bank Statement
            if (req.files.bankStatement) {
                const stmtResult = await cloudinary.uploader.upload(req.files.bankStatement[0].path, {
                    folder: 'loan_documents/statements',
                    resource_type: 'auto'
                });
                bankStmtUrl = stmtResult.secure_url;
                console.log("Bank Statement uploaded to Cloudinary:", bankStmtUrl);
                // Remove local file after successful upload
                fs.unlinkSync(req.files.bankStatement[0].path);
            }
        }

        // 3. Prepare data for the Model (Aligned with Updated Model.apply)
        const loanData = {
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
        };

        // 4. Call the Model
        OnlineLoanModel.apply(loanData, (err, result) => {
          console.log('Controller callback:', err, result);
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: "Failed to save loan application to database.",
                    error: err.message 
                });
            }

            return res.status(201).json({
                success: true,
                message: "Application submitted successfully!",
                data: result,
                documents: { idDocUrl, bankStmtUrl }
            });
        });

    } catch (error) {
        console.error("Controller Error:", error);
        
        // Safety cleanup: If upload fails or logic crashes, try to remove temp files if they still exist
        if (req.files) {
            if (req.files.idDocument && fs.existsSync(req.files.idDocument[0].path)) fs.unlinkSync(req.files.idDocument[0].path);
            if (req.files.bankStatement && fs.existsSync(req.files.bankStatement[0].path)) fs.unlinkSync(req.files.bankStatement[0].path);
        }

        res.status(500).json({ 
            success: false, 
            message: "Internal server error during application process." 
        });
    }
};

/**
 * 2. PHYSICAL LOAN REQUEST (BRANCH-BASED)
 * For loans requiring manual review and employee approval.
 */
exports.requestPhysicalLoan = (req, res) => {
  const customerId = req.user?.customer_id;
  const { branchId, savingsId, loanTypeId, amount, duration, interestRate } = req.body;

  if (!branchId || !savingsId || !amount) {
    return res.status(400).json({ success: false, message: "Branch, Savings Account, and Amount are required." });
  }

  const loanData = {
    customerId,
    branchId,
    employeeId: null, // To be assigned by branch staff
    savingsId,
    loanTypeId,
    amount,
    duration,
    interestRate: interestRate || 15.0 // Default or type-based rate
  };

  PhysicalLoanModel.request(loanData, (err, result) => {
    if (err) {
      console.error("[PhysicalLoan Request Error]:", err);
      return res.status(500).json({ success: false, message: "Failed to submit loan application. Please try again later." });
    }
    res.status(201).json({ 
      success: true, 
      message: "Your application has been submitted to the branch. You will be notified once a credit officer reviews it.",
      applicationId: result.insertId
    });
  });
};

/**
 * 3. LOAN REPAYMENT (INSTALLMENTS)
 * Interacts with 'pay_online_installment' stored procedure.
 */
exports.payLoanInstallment = (req, res) => {
  const { installmentId } = req.body;

  if (!installmentId) {
    return res.status(400).json({ success: false, message: "Installment ID is required for processing payment." });
  }

  InstallmentModel.payOnlineInstallment(installmentId, (err, result) => {
    if (err) {
      console.error("[Repayment Error]:", err.message);

      // Handle Stored Procedure specific errors
      if (err.message === 'INSUFFICIENT_FUNDS') {
        return res.status(402).json({ 
          success: false, 
          message: "Payment failed: Linked savings account has insufficient balance." 
        });
      }

      return res.status(400).json({ 
        success: false, 
        message: err.message || "Repayment processing failed." 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: "Repayment successful. Account balance and loan schedule updated." 
    });
  });
};

/**
 * 4. LOAN DATA RETRIEVAL (DASHBOARD)
 */
exports.getCustomerLoans = (req, res) => {
  const customerId = req.user?.customer_id;

  OnlineLoanModel.getCustomerLoans(customerId, (err, loans) => {
    if (err) return res.status(500).json({ success: false, message: "Error fetching loan records." });
    res.status(200).json({ success: true, data: loans });
  });
};

exports.getLoanInstallments = (req, res) => {
  const { loanId } = req.params;
  const { type } = req.query; // 'online' or 'physical'

  if (!loanId || !type) {
    return res.status(400).json({ success: false, message: "Loan ID and Type (online/physical) are required." });
  }

  InstallmentModel.getPendingByLoan(loanId, type, (err, installments) => {
    if (err) return res.status(500).json({ success: false, message: "Error fetching payment schedule." });
    res.status(200).json({ success: true, data: installments });
  });
};

/**
 * 5. UTILITY DATA (FOR FORMS)
 */
exports.getEligibleCollateral = (req, res) => {
  const customerId = req.user?.customer_id;

  FixedDepositModel.getEligibleCollateral(customerId, (err, fds) => {
    if (err) return res.status(500).json({ success: false, message: "Error retrieving eligible FDs." });
    res.status(200).json({ success: true, data: fds });
  });
};

exports.getLoanTypes = (req, res) => {
  LoanTypeModel.getAll((err, types) => {
    if (err) return res.status(500).json({ success: false, message: "Error retrieving loan products." });
    res.status(200).json({ success: true, data: types });
  });
};