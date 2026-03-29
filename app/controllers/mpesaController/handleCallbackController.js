const MpesaTransaction = require('../../models/mpesaModel.js');
const AccountModel = require('../../models/userAccountModel.js');

exports.handleStkPushCallback = async function(req, res) {
  try {
    const body = req.body;
    console.log("Received STK Push callback:", JSON.stringify(body, null, 2));

    if (!body?.Body?.stkCallback) {
      return res.status(400).json({ success: false, message: "Invalid callback data" });
    }

    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = body.Body.stkCallback;

    // 1. Handle Failed Payments (User cancelled, insufficient funds, etc.)
    if (ResultCode !== 0) {
      console.log(`Payment failed [${ResultCode}]: ${ResultDesc}`);
      
      // Update our record to 'failed' so the UI can stop polling
      await new Promise((resolve) => {
        MpesaTransaction.updateStatusByCheckoutID(CheckoutRequestID, { 
          status: 'failed', 
          mpesa_code: 'FAILED' 
        }, resolve);
      });
      return res.json({ success: false, message: ResultDesc });
    }

    // 2. Extract Metadata for Successful Payments
    const items = CallbackMetadata.Item;
    const amount = items.find(i => i.Name === "Amount")?.Value;
    const mpesaCode = items.find(i => i.Name === "MpesaReceiptNumber")?.Value;
    const phone = items.find(i => i.Name === "PhoneNumber")?.Value;

    console.log("Verified Metadata:", { amount, mpesaCode, phone, CheckoutRequestID });

    // 3. Find our internal Mpesa record using the CheckoutRequestID
    const mpesaRecord = await new Promise((resolve, reject) => {
      MpesaTransaction.findByCheckoutId(CheckoutRequestID, (err, record) => {
        if (err) return reject(err);
        resolve(record);
      });
    });

    if (!mpesaRecord) {
      console.error("CRITICAL: Mpesa record not found for CheckoutID:", CheckoutRequestID);
      return res.status(404).json({ success: false, message: "Transaction record not found" });
    }

    // 4. Update Mpesa record status to 'completed'
    await new Promise((resolve, reject) => {
      MpesaTransaction.updateStatusByCheckoutID(CheckoutRequestID, {
        status: 'completed',
        mpesa_code: mpesaCode
      }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // 5. Update the User's Account Balance
    // We use mpesaRecord.account_id which is guaranteed to be the right user
    await new Promise((resolve, reject) => {
      AccountModel.depositViaMpesa(
        mpesaRecord.account_id,
        amount,
        phone,
        mpesaCode,
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    console.log(`Successfully processed deposit: ${mpesaCode} for Account: ${mpesaRecord.account_id}`);

    // Safaricom expects a standard JSON response to acknowledge receipt
    return res.json({ 
      ResultCode: 0, 
      ResultDesc: "Accepted" 
    });

  } catch (error) {
    console.error("Error handling STK Push callback:", error);
    // Even on error, we return a 200/Success to Safaricom so they stop retrying
    return res.status(200).json({ success: false, message: "Processed with internal error" });
  }
};

