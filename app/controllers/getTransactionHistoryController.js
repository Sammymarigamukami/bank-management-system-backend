const Transaction = require("../models/transactionModel.js");


exports.getUserHistory = (req, res) => {
  const customerId = req.params.customerId;
  const filters = {
    type: req.query.type || 'all',
    status: req.query.status || 'all',
    fromDate: req.query.fromDate || null,
    toDate: req.query.toDate || null,
    minAmount: req.query.minAmount || null,
    maxAmount: req.query.maxAmount || null
  };

  Transaction.getHistoryByCustomer(customerId, filters, (err, data) => {
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


exports.getCustomerAnalytics = (req, res) => {
  // 1. Get Customer ID from the authenticated user object
  // (In your system, this is usually attached by the verifyToken middleware)
  const customerId = req.user?.customer_id || req.params.customerId;

  if (!customerId) {
    return res.status(400).json({
      success: false,
      message: "Customer ID is required to generate analytics."
    });
  }

  // 2. Call the Model method we built
  Transaction.getSpendingAnalytics(customerId, (err, data) => {
    if (err) {
      console.error("[Analytics Controller Error]:", err);
      return res.status(500).json({
        success: false,
        message: "An error occurred while calculating spending analytics.",
        error: err.message
      });
    }

    // 3. Handle Empty State
    if (!data || data.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No spending data found for this period.",
        data: []
      });
    }

    // 4. Return the formatted data
    // This matches the format: [{ category: 'Transfer', amount: 500, percentage: 25 }, ...]
    res.status(200).json({
      success: true,
      data: data
    });
  });
};
