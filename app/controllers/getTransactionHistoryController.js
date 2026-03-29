const Transaction = require("../models/transactionModel.js");


exports.getUserHistory = (req, res) => {
  const accountId = req.params.accountId;
  const filters = {
    type: req.query.type || 'all',
    status: req.query.status || 'all',
    fromDate: req.query.fromDate || null,
    toDate: req.query.toDate || null,
    minAmount: req.query.minAmount || null,
    maxAmount: req.query.maxAmount || null
  };

  Transaction.getFilteredHistoryByAccount(accountId, filters, (err, data) => {
    if (err) {
      return res.status(500).send({
        success: false,
        message: "Error retrieving history"
      });
    }
    
    res.status(200).send({
      success: true,
      data: data
    });
  });
};

exports.getAdminTransactions = (req, res) => {
  // Default to last 50 transactions if no limit is provided
  const limit = parseInt(req.query.limit) || 50;

  Transaction.getAdminGlobalHistory(limit, (err, data) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error fetching global transactions"
      });
    }
    res.status(200).json({
      success: true,
      data: data
    });
  });
};