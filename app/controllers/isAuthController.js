const AccountModel = require("../models/userAccountModel.js");

const userAuth = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const isCustomer = !!req.user.customer_id;
    const userId = req.user.customer_id || req.user.employee_id;
    
    let accountId = null;
    let accountNumber = null;
    let allAccounts = {}; // Store the categorized object here

    if (isCustomer) {
      // 1. Fetch categorized accounts
      allAccounts = await new Promise((resolve) => {
        AccountModel.getActiveAccounts(req.user.customer_id, (err, accounts) => {
          if (err || !accounts || Object.keys(accounts).length === 0) {
            return resolve({}); 
          }
          resolve(accounts);
        });
      });

      // 2. Access the 'checking' (current) account safely from the object
      // Using 'checking' because that is the key in your categorized object
      const currentAccount = allAccounts.current?.[0] || null;
      console.log("current account for auth payload:", { currentAccount });
      
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
      role: req.user.role,
      phone: req.user.phone || null,
    };
    // console.log("current account for auth payload:", { account });

    if (isCustomer) {
      userPayload.accountId = accountId;
      userPayload.accountNumber = accountNumber;
      // Optional: Attach all accounts so the frontend doesn't have to fetch again immediately
      userPayload.accounts = allAccounts; 
    }

    return res.status(200).json({
      success: true,
      user: userPayload
    });

  } catch (error) {
    console.error("Auth payload error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

module.exports = { userAuth };