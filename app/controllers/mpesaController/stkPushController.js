const {
  buildStkPassword,
  getAccessToken,
  mpesaTimestamp,
  normalizeMsisdn,
  darajaBase,
} = require("../../utils/mpesa.js");

const MpesaTransaction = require("../../models/mpesaModel.js");
const Account = require("../../models/userAccountModel.js"); // Ensure this is imported

/**
 * Initiates an M-Pesa STK Push (Lipa Na M-Pesa Online)
 */
const initializeSTKPush = async (req, res) => {
  try {
    const { phone, amount, accountId } = req.body;

    // 1. Basic Validation
    if (!phone || !amount || !accountId) {
      return res.status(400).json({ 
        success: false, 
        error: "Phone number, amount, and account ID are required." 
      });
    }

    // 2. Validate that the target account is a 'current' account
    // This prevents users from trying to deposit into savings via this route
    const accountValid = await new Promise((resolve) => {
        Account.findByAccountId(accountId, (err, account) => {
            if (err || !account || account.account_type !== 'current') resolve(false);
            else resolve(true);
        });
    });

    if (!accountValid) {
        return res.status(400).json({
            success: false,
            error: "Deposits are only permitted for active Current Accounts."
        });
    }

    const orderId = `ORD-${Date.now()}`;
    const normalizedPhone = normalizeMsisdn(phone);

    // 3. Create Initial Record (Pending)
    const newTx = new MpesaTransaction({
      account_id: accountId,
      phone_number: normalizedPhone,
      amount: amount,
      reference_code: orderId,
      status: 'pending'
    });

    // We still use the Promise wrapper here because .create is likely still using callbacks
    await new Promise((resolve, reject) => {
      MpesaTransaction.create(newTx, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    // 4. Prepare Daraja Authentication & Payload
    const timestamp = mpesaTimestamp();
    const token = await getAccessToken();
    const password = buildStkPassword(
      process.env.DARAJA_SHORTCODE,
      process.env.DARAJA_PASSKEY,
      timestamp
    );

    // 5. Hit Safaricom Daraja API
    const stkResponse = await fetch(`${darajaBase}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: process.env.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        Amount: Number(amount),
        PartyA: normalizedPhone,
        PartyB: process.env.DARAJA_SHORTCODE,
        PhoneNumber: normalizedPhone,
        TransactionType: "CustomerPayBillOnline",
        AccountReference: orderId, 
        TransactionDesc: "Deposit to Current Account",
        CallBackURL: `${process.env.BASE_URL}/user/api/deposit/callback`,
      }),
    });

    const data = await stkResponse.json();

    // 6. Check if Safaricom accepted the request
    if (data.ResponseCode === "0") {
      
      // 7. Link IDs using the NEW Promise-based Model Method
      // NO MORE WRAPPING IN NEW PROMISE HERE!
      await MpesaTransaction.setCheckoutIDs(
        orderId, 
        data.MerchantRequestID, 
        data.CheckoutRequestID
      );

      console.log("STK Push linked to order:", orderId);

      return res.status(200).json({
        success: true,
        message: "STK Push sent to phone. Please enter your PIN.",
        checkoutRequestId: data.CheckoutRequestID,
        customerMessage: data.CustomerMessage
      });
      
    } else {
      return res.status(400).json({
        success: false,
        error: data.errorMessage || "STK Push failed to initialize",
        details: data
      });
    }

  } catch (error) {
    console.error("Critical STK Push Error:", error.message);
    return res.status(500).json({ 
      success: false, 
      error: "An internal error occurred while processing your request." 
    });
  }
};

module.exports = {
  initializeSTKPush,
};