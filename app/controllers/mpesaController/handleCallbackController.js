const AccountModel = require('../../models/userAccountModel.js');

exports.handleStkPushCallback = async function(req, res) {
  try {

    const body = req.body;
    console.log("Received STK Push callback:", JSON.stringify(body, null, 2));

    if (!body || !body.Body || !body.Body.stkCallback) {
      return res.status(400).json({ success: false, message: "Invalid callback data" });
    }

    const callback = body.Body.stkCallback;
    const resultCode = callback.ResultCode;
    const resultDesc = callback.ResultDesc;

    console.log("STK Result:", resultCode, resultDesc);

    //  Payment failed
    if (resultCode !== 0) {
      console.log("Payment failed:", resultDesc);
      return res.json({ success: false, message: "Payment failed" });
    }

    //  Extract metadata
    const items = callback.CallbackMetadata.Item;

    const amount = items.find(i => i.Name === "Amount")?.Value;
    const mpesaCode = items.find(i => i.Name === "MpesaReceiptNumber")?.Value;
    const phone = items.find(i => i.Name === "PhoneNumber")?.Value;

    console.log("Parsed callback:", { amount, mpesaCode, phone });

    if (!amount || !mpesaCode || !phone) {
      return res.status(400).json({ success: false, message: "Missing transaction data" });
    }

    //  CRITICAL: find account using phone
    const account = await new Promise((resolve, reject) => {
      AccountModel.findByPhone(phone, (err, acc) => {
        if (err) return reject(err);
        resolve(acc);
      });
    });

    if (!account) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    //  Perform deposit (robust function)
    await new Promise((resolve, reject) => {
      AccountModel.depositViaMpesa(
        account.account_id,
        amount,
        phone,
        mpesaCode,
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    console.log("Deposit successful for:", mpesaCode);

    return res.json({ success: true });

  } catch (error) {
    console.error("Error handling STK Push callback:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

