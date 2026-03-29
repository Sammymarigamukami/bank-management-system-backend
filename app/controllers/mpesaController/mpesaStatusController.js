const MpesaTransaction = require("../../models/mpesaModel.js");

/**
 * Checks the current status of an M-Pesa transaction
 * Used by the frontend to stop the "Processing" spinner
 */
const getTransactionStatus = async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;

    if (!checkoutRequestId) {
      return res.status(400).json({ 
        success: false, 
        message: "Checkout Request ID is required" 
      });
    }

    // Use the model method we defined earlier
    MpesaTransaction.findByCheckoutId(checkoutRequestId, (err, transaction) => {
      if (err) {
        if (err.kind === "not_found") {
          return res.status(404).json({ 
            success: false, 
            message: "Transaction not found" 
          });
        }
        return res.status(500).json({ 
          success: false, 
          message: "Error retrieving transaction status" 
        });
      }

      // Return the status ('pending', 'completed', or 'failed')
      // Also return the mpesa_code if it exists (for the success screen)
      return res.status(200).json({
        success: true,
        status: transaction.status,
        mpesaCode: transaction.mpesa_code,
        amount: transaction.amount,
        updatedAt: transaction.updated_at
      });
    });

  } catch (error) {
    console.error("Status Check Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getTransactionStatus
};