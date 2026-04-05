
const PaybillModel = require('../models/payBillModel.js');

exports.PaybillController = (req, res) => {
    const customerId = req.user?.customer_id; 
    const { businessNumber, accountReference, amount, description } = req.body;

    // 1. Basic Validation
    if (!businessNumber || !accountReference || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: "Business number, account reference, and amount are required." 
      });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a valid amount greater than zero." 
      });
    }

    // 2. Process via Model
    const paymentData = {
      customerId,
      businessNumber,
      accountReference,
      amount: parseFloat(amount),
      description
    };

    PaybillModel.processPayment(paymentData, (err, result) => {
      if (err) {
        console.error("[Paybill Error]", err.message);
        const statusCode = err.message.includes("funds") ? 400 : 500;
        return res.status(statusCode).json({ 
          success: false, 
          message: err.message || "An error occurred while processing the bill payment." 
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment successful.",
        data: result
      });
    });
}

exports.getPaymentHistory = (req, res) => {
    const customerId = req.user?.customer_id;
    PaybillModel.getHistory(customerId, (err, history) => {
      if (err) {
        console.error("[Paybill History Error]", err);
        return res.status(500).json({ success: false, message: "Could not retrieve payment history." });
      }

      return res.status(200).json({
        success: true,
        data: history
      });
  });
}