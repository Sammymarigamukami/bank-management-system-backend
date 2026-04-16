const { isAccountOwnedByCustomer } = require('../middleware/middleware.js');
const AccountModel = require('../models/userAccountModel.js');
const generateAccountNumber = require('../utils/accountNumberGenerator.js');
const sql = require('../models/db.js');

const accountNumber = generateAccountNumber();
// Retrieve all accounts for a customer or all accounts
exports.findAll = (req, res) => {
  //console.log(req.params);
  const customerID = req.user.CustomerID;
  AccountModel.getAll(customerID, req, (err, data) => {
    if (err.kind === 'not_found') {
      res.status(404).send({
        message: `No accounts found for customer ${customerID}.`,
      });
    } else if (err.kind != 'success') {
      res.status(500).send({
        message:
          err.message || 'Some error occurred while retrieving accounts.',
      });
    } else res.send(data);
  });
};

// Retrieve an account by ID
exports.getFromID = (req, res) => {
  const accountID = req.params.id;
  AccountModel.findById(accountID, req, (err, data) => {
    if (err.kind === 'not_found') {
      res.status(404).send({
        message: `No account found with id ${accountID}.`,
      });
    } else if (err.kind != 'success') {
      res.status(500).send({
        message: err.message || 'Some error occurred while retrieving account.',
      });
    } else if (err.kind === 'access denied') {
      res.status(401).send({
        message: err.message || 'Access Denied to Page',
      });
    } else res.send(data);
  });
};

// Create a new account
exports.create = (req, res) => {
  console.log(req.user.BranchID);
  const account = {
    CustomerID: req.body.account.customerID,
    TypeID: req.body.account.accountType,
    BranchID: req.user.BranchID,
    Balance: req.body.account.initialBalance,
  };
  AccountModel.create(account, req, (err, data) => {
    if (err.kind === 'error') {
      res.status(500).send({
        message: err.message || 'Some error occurred while creating account.',
      });
    } else res.send(data);
  });
};


exports.getActiveAccounts = async (req, res) => {
  const customerID = req.user.customer_id;
  console.log("customerID:", customerID);

  try {
    // Wrap the callback-based function in a Promise
    const accounts = await new Promise((resolve, reject) => {
      AccountModel.getActiveAccounts(customerID, (err, data) => {
        if (err) return reject(err);       // reject the promise on error
        resolve(data);                     // resolve the promise with data
      });
    });

    if (!accounts || accounts.length === 0) {
      return res.status(404).send({
        message: `No active accounts found for customer ${customerID}`
      });
    }

    return res.status(200).send({
      accounts
    });

  } catch (err) {
    return res.status(500).send({
      message: err.message || "Database error"
    });
  }
};


exports.transferFundByAccountNumber = (req, res) => {
  const { receiverAccountNumber, amount, description } = req.body;
  
  // 1. Authenticated User Guard
  // Extracting customer_id from the authenticated user object
  const senderCustomerId = req.user?.customer_id;
  
  console.log(`[Transfer Request] Sender Customer ID: ${senderCustomerId} -> Receiver Account Number: ${receiverAccountNumber}`);

  if (!senderCustomerId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to perform this action."
    });
  }

  // 2. Input Validation
  if (!receiverAccountNumber) {
    return res.status(400).json({
      success: false,
      message: "Recipient Account Number is required."
    });
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid transfer amount greater than zero."
    });
  }

  // 3. Model Execution
  // Calling the specific method for account number lookup in the Account Model
  AccountModel.transferFundsByAccountNumber(
    senderCustomerId,
    receiverAccountNumber,
    numericAmount,
    description || "Internal Transfer",
    (err, result) => {
      
      // 4. Advanced Error Handling
      if (err) {
        console.error(`[Transfer Error] Sender CID: ${senderCustomerId} -> Recipient Acc: ${receiverAccountNumber}`, err.message);

        // Map specific business logic errors to 400 Bad Request
        const businessLogicErrors = [
          "Insufficient funds",
          "Recipient account number not found",
          "Cannot transfer to yourself",
          "Sender account not found"
        ];

        if (businessLogicErrors.includes(err.message)) {
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }

        // Default to 500 Internal Server Error for DB/System failures
        return res.status(500).json({
          success: false,
          message: "An internal error occurred during the transfer. Please try again later."
        });
      }

      // 5. Success Response
      return res.status(200).json({
        success: true,
        message: "Money transferred successfully.",
        data: {
          referenceCode: result.referenceCode,
          amount: numericAmount,
          recipientAccountNumber: receiverAccountNumber,
          timestamp: new Date().toISOString()
        }
      });
    }
  );
};

exports.transferFundsByCustomerID = (req, res) => {
  // 1. Destructure the request body
  const { receiverCustomerId, amount, description } = req.body;

  // 2. Get the sender's account ID from the authenticated user object
  // Assuming your auth middleware populates req.user with the customer's account details
  const senderAccountId = req.user?.customer_id;


  // 3. Basic Validation
  if (!receiverCustomerId) {
    return res.status(400).json({ 
      success: false, 
      message: "Receiver customer ID is required." 
    });
  }

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    return res.status(400).json({ 
      success: false, 
      message: "Please enter a valid positive amount." 
    });
  }

  if (!senderAccountId) {
    return res.status(401).json({ 
      success: false, 
      message: "Unauthorized: Sender account not found." 
    });
  }

  // 4. Call the Model method using the callback pattern
  AccountModel.transferFundsByCustomerId(
    senderAccountId,
    receiverCustomerId,
    parseFloat(amount),
    description || "Internal Transfer",
    (err, result) => {
      // 5. Handle Model Errors (Insufficient funds, user not found, etc.)
      if (err) {
        console.error("Transfer Error:", err.message);
        
        // Return 400 for business logic errors, 500 for database crashes
        const statusCode = [
          "Insufficient funds", 
          "Recipient user does not have an active account",
          "Cannot transfer to yourself"
        ].includes(err.message) ? 400 : 500;

        return res.status(statusCode).json({
          success: false,
          message: err.message
        });
      }

      // 6. Return Success Response
      return res.status(200).json({
        success: true,
        message: "Transfer completed successfully.",
        data: {
          referenceCode: result.referenceCode,
          recipientAccount: result.recipientAccount,
          amountSent: parseFloat(amount)
        }
      });
    }
  );
};

// Freeze an account for security reasons (e.g., suspected fraud)
exports.freezeAccount = (req, res) => {
  const { accountId } = req.params;

  AccountModel.updateAccountStatus(accountId, 'frozen', (err, result) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(200).json({ success: true, message: "Account has been frozen for security reasons.", data: result });
  });
};


exports.closeAccount = (req, res) => {
  const { accountId } = req.params;

  AccountModel.updateAccountStatus(accountId, 'closed', (err, result) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(200).json({ success: true, message: "Account has been permanently closed.", data: result });
  });
};

// Activate a business account after verification
exports.activateAccounts = (req, res) => {
  const { customerID, accountType } = req.params;

  // 1. Authorization Guard
  if (req.user?.role !== 'admin' && req.user?.role !== 'employee') {
    return res.status(403).json({
      success: false,
      message: "Access Denied. Only authorized staff can verify business accounts."
    });
  }

  // 2. CHECK: Does this account type already exist for this customer?
  const checkQuery = "SELECT * FROM accounts WHERE customer_id = ? AND account_type = ?";
  
  sql.query(checkQuery, [customerID, accountType], (err, existingAccounts) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Error checking existing accounts." });
    }

    if (existingAccounts.length > 0) {
      const account = existingAccounts[0];
      if (account.status === 'active') {
        return res.status(409).json({ 
          success: false, 
          message: `This customer already has an active ${accountType} account.` 
        });
      }
      // If it exists but is 'not_active', you might want to update it instead of inserting new
      return res.status(400).json({ 
        success: false, 
        message: `An inactive ${accountType} account already exists for this user.` 
      });
    }


    const accountData = {
      customer_id: customerID,
      account_number: accountNumber,
      account_type: accountType,
      status: 'not_active' // Initial state
    };

    // 4. Perform Insertion
    sql.query("INSERT INTO accounts SET ?", accountData, (err, dbres) => {
      if (err) {
        console.error("Insert Error:", err);
        return res.status(500).json({ success: false, message: "Database error during account creation." });
      }

      // 5. Update Status to Active
      AccountModel.updateAccountStatus(dbres.insertId, 'active', (err) => {
        if (err) {
          return res.status(400).json({ success: false, message: err.message });
        }

        return res.status(201).json({
          success: true,
          message: "Business account has been successfully verified and activated.",
          data: { 
            accountId: dbres.insertId, 
            customer_id: customerID,
            account_number: accountNumber,
            account_type: accountType,
            status: 'active'
          }
        });
      });
    });
  });
};


exports.closeBusinessAccount = (req, res) => {
  const { accountId } = req.params;

  // Strict Admin-Only Guard for terminal actions
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: "Access Denied. Only administrators can permanently close business accounts."
    });
  }

  // Uses the specialized blockBusinessAccount method from the model
  AccountModel.blockBusinessAccount(accountId, (err, result) => {
    if (err) {
      const statusCode = err.message === "Account not found" ? 404 : 400;
      return res.status(statusCode).json({ success: false, message: err.message });
    }

    return res.status(200).json({
      success: true,
      message: "Business account has been permanently closed/blocked.",
      data: result
    });
  });
};


exports.closeSavingsAccount = (req, res) => {
  const { accountId } = req.params;

  // Strict Admin-Only Guard
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: "Access Denied. Only administrators can permanently close savings accounts."
    });
  }

  AccountModel.blockSavingsAccount(accountId, (err, result) => {
    if (err) {
      const statusCode = err.message === "Account not found" ? 404 : 400;
      return res.status(statusCode).json({ success: false, message: err.message });
    }

    return res.status(200).json({
      success: true,
      message: "Savings account has been permanently closed/blocked.",
      data: result
    });
  });
};


exports.updateStatus = (req, res) => {
  const { accountId } = req.params;
  const { status } = req.body; // e.g., 'frozen' or 'closed'

  // 1. Strict Authorization Guard: Only 'admin' can freeze/close accounts
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: "Access Denied. Only administrators can freeze or close accounts." 
    });
  }

  // 2. Input Validation
  if (!['frozen', 'closed'].includes(status)) {
    return res.status(400).json({ 
      success: false, 
      message: "Invalid status requested. Use 'frozen' or 'closed'." 
    });
  }

  // 3. Call Model Logic
  AccountModel.updateAccountStatus(accountId, status, (err, result) => {
    if (err) {
      // Map model errors to response codes
      const statusCode = err.message === "Account not found" ? 404 : 400;
      return res.status(statusCode).json({ success: false, message: err.message });
    }
    
    res.status(200).json({ 
      success: true, 
      message: `Account status updated to ${status} successfully.`, 
      data: result 
    });
  });
};
