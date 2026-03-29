const {
  buildStkPassword,
  getAccessToken,
  mpesaTimestamp,
  normalizeMsisdn,
  darajaBase,
} = require("../../utils/mpesa.js");

const MpesaTransaction = require("../../models/mpesaModel.js");

/**
 * Initiates an M-Pesa STK Push (Lipa Na M-Pesa Online)
 * 1. Validates input
 * 2. Creates a 'pending' record in the database
 * 3. Requests STK Push from Safaricom Daraja API
 * 4. Links the Daraja CheckoutRequestID to our internal record
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

    const orderId = `ORD-${Date.now()}`;
    const normalizedPhone = normalizeMsisdn(phone);

    // 2. Create Initial Record (Pending)
    // Using the model constructor and the create method we defined
    const newTx = new MpesaTransaction({
      account_id: accountId,
      phone_number: normalizedPhone,
      amount: amount,
      reference_code: orderId,
      status: 'pending'
    });
    console.log("Creating Mpesa Transaction Record:", newTx);

    await new Promise((resolve, reject) => {
      MpesaTransaction.create(newTx, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    console.log("Mpesa Transaction record created successfully for Order ID:", orderId);

    // 3. Prepare Daraja Authentication & Payload
    const timestamp = mpesaTimestamp();
    const token = await getAccessToken();
    const password = buildStkPassword(
      process.env.DARAJA_SHORTCODE,
      process.env.DARAJA_PASSKEY,
      timestamp
    );

    // 4. Hit Safaricom Daraja API
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
        TransactionDesc: "Wallet Deposit",
        CallBackURL: `${process.env.BASE_URL}/user/api/deposit/callback`,
      }),
    });

    const data = await stkResponse.json();

    // 5. Check if Safaricom accepted the request
    // ResponseCode "0" means the STK Push was successfully sent to the phone
    if (data.ResponseCode === "0") {
      
      // 6. Link IDs using the clean Model Method
      await MpesaTransaction.setCheckoutIDs(
        orderId, 
        data.MerchantRequestID, 
        data.CheckoutRequestID
      );
      console.log("STK Push initiated successfully:", { orderId, MerchantRequestID: data.MerchantRequestID, CheckoutRequestID: data.CheckoutRequestID });

      return res.status(200).json({
        success: true,
        message: "STK Push sent to phone. Please enter your PIN.",
        checkoutRequestId: data.CheckoutRequestID,
        customerMessage: data.CustomerMessage
      });
      
    } else {
      // Handle cases where Safaricom rejected the request immediately
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

