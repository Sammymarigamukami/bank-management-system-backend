const dotenv = require("dotenv");
dotenv.config();

/**
 * Returns the correct Daraja API base URL depending on environment.
 */
const darajaBase =
  process.env.DARAJA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

/**
 * Generates timestamp: YYYYMMDDHHMMSS
 */
function mpesaTimestamp() {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0")
  );
}

/**
 * Builds STK password
 */
function buildStkPassword(shortcode, passkey, timestamp) {
  return Buffer.from(shortcode + passkey + timestamp).toString("base64");
}

/**
 * Normalize phone → 2547XXXXXXXX
 */
function normalizeMsisdn(phone) {
  let msisdn = phone.trim();

  if (msisdn.startsWith("+")) {
    msisdn = msisdn.substring(1);
  }
  if (msisdn.startsWith("0")) {
    msisdn = "254" + msisdn.substring(1);
  }

  return msisdn;
}

/**
 * Get access token
 */
async function getAccessToken() {
  const res = await fetch(
    `${darajaBase}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.DARAJA_CONSUMER_KEY +
              ":" +
              process.env.DARAJA_CONSUMER_SECRET
          ).toString("base64"),
      },
    }
  );

  const data = await res.json();
  return data.access_token;
}

/**
 * Export everything
 */
module.exports = {
  darajaBase,
  mpesaTimestamp,
  buildStkPassword,
  normalizeMsisdn,
  getAccessToken,
};
