const MpesaTransaction = require('../../models/mpesaModel.js');

exports.handleStkPushCallback = async function(req, res) {
  try {
    console.log("Received M-Pesa Callback:", JSON.stringify(req.body));
    const body = req.body;
    
    if (!body?.Body?.stkCallback) {
      return res.status(400).json({ success: false, message: "Invalid callback data" });
    }

    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = body.Body.stkCallback;

    // 1. Handle Failed Payments (User cancelled, timeout, etc.)
    if (ResultCode !== 0) {
      console.log(`Payment failed [${ResultCode}]: ${ResultDesc}`);
      
      await new Promise((resolve) => {
        MpesaTransaction.updateStatusByCheckoutID(CheckoutRequestID, { 
          status: 'failed', 
          mpesa_code: 'FAILED' 
        }, resolve);
      });
      
      return res.json({ ResultCode: 0, ResultDesc: "Failure Acknowledged" });
    }

    // 2. Extract Metadata for Success
    const items = CallbackMetadata.Item;
    const mpesaCode = items.find(i => i.Name === "MpesaReceiptNumber")?.Value;

    // 3. THE UPDATED TRANSACTIONAL CALL
    // This now handles finding the account, checking if it's 'current', 
    // adding the balance, and inserting into the ledger.

    const transactionResult = await new Promise((resolve, reject) => {
      console.log("Processing successful payment for CheckoutRequestID:", CheckoutRequestID);
      MpesaTransaction.updateStatusByCheckoutID(
        CheckoutRequestID, 
        { 
          status: 'completed', 
          mpesa_code: mpesaCode 
        }, 
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    console.log("Deposit successfully finalized:", transactionResult);

    return res.json({ 
      ResultCode: 0, 
      ResultDesc: "Accepted" 
    });

  } catch (error) {
    console.error("Callback Error:", error.message);
    // Standard response to Safaricom
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Error processed" });
  }
};

