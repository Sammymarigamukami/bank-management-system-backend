const OnlineCustomer = require("../models/online.customer.model.js");
const Transaction = require("../models/transactionModel.js");
const FinancialStats = require("../models/financialStatsModel.js");


exports.getCustomerFullProfile = (req, res) => {
  const customerId = req.params.customerId;
  

  const filters = {
    type: req.query.type || 'all',
    status: req.query.status || 'all',
    fromDate: req.query.fromDate || null,
    toDate: req.query.toDate || null,
    minAmount: req.query.minAmount || null,
    maxAmount: req.query.maxAmount || null
  };

  OnlineCustomer.getFullProfile(customerId, (err, profileData) => {
    console.log("Profile Data:", profileData);
    if (err) return res.status(500).json({ success: false, message: "Profile Error" });

    // Use the filtered history method instead of the generic one
    Transaction.getFilteredHistoryByAccount(profileData.account_id, filters, (err, history) => {
      if (err) return res.status(500).json({ success: false, message: "History Error" });

      res.status(200).json({
        success: true,
        data: {
          profile: profileData,
          transactions: history
        }
      });
    });
  });
};

exports.findAll = (req, res) => {
  OnlineCustomer.getAllForAdmin((err, data) => {
    if (err) {
      // 500 Internal Server Error for DB issues
      res.status(500).send({
        success: false,
        message: err.message || "Some error occurred while retrieving customer data."
      });
    } else {
      // If no data is found, send a 204 (No Content) or an empty array
      if (data.length === 0) {
        res.status(200).send({
          success: true,
          message: "No customers found in the system.",
          count: 0,
          data: []
        });
      } else {
        // Return the formatted list
        res.status(200).send({
          success: true,
          count: data.length,
          data: data
        });
      }
    }
  });
};

exports.getAccountReport = (req, res) => {
  FinancialStats.getActiveAccountsReport((err, data) => {
    if (err) {
      res.status(500).send({
        success: false,
        message: "Error retrieving active accounts report."
      });
    } else {
      res.status(200).send({
        success: true,
        count: data.length,
        data: data
      });
    }
  });
};