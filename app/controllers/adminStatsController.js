
const OnlineCustomer = require('../models/online.customer.model.js');
const Transaction = require('../models/transactionModel.js');
const MpesaTransaction = require('../models/mpesaModel.js');

const getAdminDashboardData = (req, res) => {
  console.log("Fetching admin dashboard data...");
  console.log("Request query params:", req.query);
  //  Get Total Customers
  OnlineCustomer.countAll((err, totalCust) => {
    if (err) return res.status(500).json({ success: false, message: "Error fetching customers" });
    console.log("Total Customers:", totalCust);
    //  Get Active Accounts
    OnlineCustomer.countActive((err, activeAcc) => {
      if (err) return res.status(500).json({ success: false, message: "Error fetching active accounts" });
      console.log("Active Accounts:", activeAcc);
      // Get Total Transactions (General Ledger)
      Transaction.countAll((err, totalTx) => {
        if (err) return res.status(500).json({ success: false, message: "Error fetching transactions" });
        console.log("Total Transactions:", totalTx);
        //  Get Total M-Pesa Transactions
        MpesaTransaction.countAll((err, totalMpesa) => {
          if (err) return res.status(500).json({ success: false, message: "Error fetching M-Pesa data" });
          console.log("Total M-Pesa Transactions:", totalMpesa);
          //  Response once all callbacks are finished
          res.status(200).json({
            success: true,
            data: {
              totalCustomers: totalCust || 0,
              activeAccounts: activeAcc || 0,
              totalTransactions: totalTx || 0,
              totalMpesaTransactions: totalMpesa || 0,
              timestamp: new Date()
            }
          });
        });
      });
    });
  });
};



exports.getAdminDashboardData = getAdminDashboardData;