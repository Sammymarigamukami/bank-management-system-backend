const sql = require('./db.js');

const MpesaTransaction = function(tx) {
  this.account_id = tx.account_id;
  this.phone_number = tx.phone_number;
  this.amount = tx.amount;
  this.mpesa_code = tx.mpesa_code || null;
  this.checkout_request_id = tx.checkout_request_id;
  this.merchant_request_id = tx.merchant_request_id;
  this.reference_code = tx.reference_code;
  this.status = tx.status || 'pending';
};

//  Create Record (Callback)
MpesaTransaction.create = (newTx, result) => {
  sql.query("INSERT INTO mpesa_transactions SET ?", newTx, (err, res) => {
    if (err) return result(err, null);
    result(null, { id: res.insertId, ...newTx });
  });
};

//  Update Status (Callback)
MpesaTransaction.updateStatusByCheckoutID = (checkoutID, updateData, result) => {
  const query = `
    UPDATE mpesa_transactions 
    SET status = ?, mpesa_code = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE checkout_request_id = ?
  `;
  sql.query(query, [updateData.status, updateData.mpesa_code, checkoutID], (err, res) => {
    if (err) return result(err, null);
    if (res.affectedRows == 0) return result({ kind: "not_found" }, null);
    result(null, res);
  });
};

//  Find By Checkout ID (Callback)
MpesaTransaction.findByCheckoutId = (checkoutID, result) => {
  sql.query("SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?", [checkoutID], (err, res) => {
    if (err) return result(err, null);
    if (res.length) return result(null, res[0]);
    result({ kind: "not_found" }, null);
  });
};

//  Admin: Get Completed (REWRITTEN TO CALLBACK)
MpesaTransaction.getCompleted = (result) => {
  const query = `
    SELECT m.*, c.username, a.account_number 
    FROM mpesa_transactions m
    JOIN accounts a ON m.account_id = a.account_id
    JOIN customers c ON a.customer_id = c.customer_id
    WHERE m.status = 'completed'
    ORDER BY m.created_at DESC
  `;
  sql.query(query, (err, res) => {
    if (err) return result(err, null);
    result(null, res);
  });
};

//  Stats: Total Collected (REWRITTEN TO CALLBACK)
MpesaTransaction.getTotalCollected = (result) => {
  sql.query("SELECT SUM(amount) AS total FROM mpesa_transactions WHERE status = 'completed'", (err, res) => {
    if (err) return result(err, null);
    result(null, res[0].total || 0);
  });
};

//  Stats: Count All (For your Dashboard)
MpesaTransaction.countAll = (result) => {
  sql.query("SELECT COUNT(*) AS total FROM mpesa_transactions", (err, res) => {
    if (err) return result(err, null);
    result(null, res[0].total || 0);
  });
};

// Link Request IDs (REWRITTEN TO CALLBACK)
MpesaTransaction.setCheckoutIDs = (referenceCode, merchantID, checkoutID, result) => {
  const query = `
    UPDATE mpesa_transactions 
    SET merchant_request_id = ?, checkout_request_id = ? 
    WHERE reference_code = ?
  `;
  sql.query(query, [merchantID, checkoutID, referenceCode], (err, res) => {
    if (err) return result(err, null);
    if (res.affectedRows === 0) return result({ kind: "not_found" }, null);
    result(null, res);
  });
};

module.exports = MpesaTransaction;