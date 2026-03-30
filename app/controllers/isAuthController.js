const AccountModel = require("../models/userAccountModel.js");

const userAuth = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // 1. Determine the Role and Identity
    const isCustomer = !!req.user.customer_id;
    const userId = req.user.customer_id || req.user.employee_id;
    
    let accountId = null;
    let accountNumber = null;

    // 2. Only fetch account details if the user is a Customer
    if (isCustomer) {
      const customerAccounts = await new Promise((resolve) => {
        AccountModel.getActiveAccounts(req.user.customer_id, (err, accounts) => {
          if (err || !accounts || accounts.length === 0) return resolve([]);
          resolve(accounts);
        });
      });

      // Find the primary 'current' account for M-Pesa deposits
      const currentAccount = customerAccounts.find(acc => acc.type === 'current');
      
      if (currentAccount) {
        accountId = currentAccount.id;
        accountNumber = currentAccount.number;
      }
    }

    // 3. Construct the Payload
    const userPayload = {
      id: userId,
      username: req.user.username || req.user.user_name,
      email: req.user.email || null,
      role: req.user.role, // 'admin', 'customer', 'employee', etc.
      phone: req.user.phone || null,
    };

    // Only attach account info if it's a customer
    if (isCustomer) {
      userPayload.accountId = accountId;
      userPayload.accountNumber = accountNumber;
    }

    res.status(200).json({
      success: true,
      user: userPayload
    });

  } catch (error) {
    console.error("Auth payload error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

module.exports = { userAuth };