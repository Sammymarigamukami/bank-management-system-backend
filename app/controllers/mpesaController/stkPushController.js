const {
  buildStkPassword,
  getAccessToken,
  mpesaTimestamp,
  normalizeMsisdn,
  darajaBase,
} = require("../../utils/mpesa.js");

const db = require("../../models/db.js");

const initializeSTKPush = async (req, res) => {
  try {
    const { phone, amount, accountId } = req.body;

    if (!phone || !amount || !accountId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const orderId = `ORD-${Date.now()}`;
    const normalizedPhone = normalizeMsisdn(phone);

    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO mpesa_transactions (account_id, phone_number, amount, reference_code, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [accountId, normalizedPhone, amount, orderId],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    console.log("Transaction saved:", orderId);

    const timestamp = mpesaTimestamp();
    const password = buildStkPassword(
      process.env.DARAJA_SHORTCODE,
      process.env.DARAJA_PASSKEY,
      timestamp
    );

    const token = await getAccessToken();

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
        TransactionDesc: "Deposit",
        CallBackURL: `${process.env.BASE_URL}/user/api/deposit/callback`,
      }),
    });

    const data = await stkResponse.json();

    if (data.errorCode) {
      return res.status(500).json({ error: data.errorMessage });
    }

    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE mpesa_transactions 
         SET checkout_request_id = ?, merchant_request_id = ? 
         WHERE reference_code = ?`,
        [data.CheckoutRequestID, data.MerchantRequestID, orderId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    return res.json({
      success: true,
      checkoutRequestId: data.CheckoutRequestID,
    });

  } catch (error) {
    console.error("STK Error:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  initializeSTKPush,
};

