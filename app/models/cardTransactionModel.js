const db = require("./db.js");

class CardTransactionModel {
  /**
   * 1. Record a new Card Transaction (Purchase/Payment)
   * Typically used when a card is swiped or used online.
   */
  static create(txData, callback) {
    const { card_id, amount, merchant_name } = txData;
    const sql = `INSERT INTO card_transactions (card_id, amount, merchant_name) 
                 VALUES (?, ?, ?)`;
    
    db.query(sql, [card_id, amount, merchant_name], (err, result) => {
      if (err) return callback(err);
      callback(null, { 
        card_tx_id: result.insertId, 
        ...txData, 
        created_at: new Date() 
      });
    });
  }

  /**
   * 2. Get Transaction History for a specific Card
   * Returns all payments made with a single card_id.
   */
  static getByCardId(cardId, callback) {
    const sql = `SELECT * FROM card_transactions 
                 WHERE card_id = ? 
                 ORDER BY created_at DESC`;
    db.query(sql, [cardId], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows);
    });
  }

  /**
   * 3. Get Recent Transactions for a Customer (Across all their cards)
   * Joins card_transactions -> cards -> accounts
   */
  static getByCustomerId(customerId, limit = 10, callback) {
    const sql = `
      SELECT ct.*, c.card_number, c.card_type
      FROM card_transactions ct
      JOIN cards c ON ct.card_id = c.card_id
      JOIN accounts a ON c.account_id = a.account_id
      WHERE a.customer_id = ?
      ORDER BY ct.created_at DESC
      LIMIT ?`;
    
    db.query(sql, [customerId, limit], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows);
    });
  }

  /**
   * 4. Get Total Spending for a Card in the current month
   * Useful for credit limit tracking or budget alerts.
   */
  static getMonthlySpending(cardId, callback) {
    const sql = `
      SELECT SUM(amount) as total_spent 
      FROM card_transactions 
      WHERE card_id = ? 
      AND MONTH(created_at) = MONTH(CURRENT_DATE())
      AND YEAR(created_at) = YEAR(CURRENT_DATE())`;
    
    db.query(sql, [cardId], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0].total_spent || 0);
    });
  }

  /**
   * 5. Get Transactions by Merchant
   * Search history for a specific store (e.g., "Amazon", "Netflix").
   */
  static getByMerchant(cardId, merchantName, callback) {
    const sql = `SELECT * FROM card_transactions 
                 WHERE card_id = ? 
                 AND merchant_name LIKE ? 
                 ORDER BY created_at DESC`;
    const searchTerm = `%${merchantName}%`;
    
    db.query(sql, [cardId, searchTerm], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows);
    });
  }

  /**
   * 6. Find a Single Transaction by ID
   */
  static getById(txId, callback) {
    const sql = "SELECT * FROM card_transactions WHERE card_tx_id = ?";
    db.query(sql, [txId], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0] || null);
    });
  }

  /**
   * 7. Analytics: Top Merchants for a user
   * Groups transactions to show where the user spends the most.
   */
  static getTopMerchants(cardId, limit = 5, callback) {
    const sql = `
      SELECT merchant_name, SUM(amount) as total_amount, COUNT(*) as visit_count
      FROM card_transactions
      WHERE card_id = ?
      GROUP BY merchant_name
      ORDER BY total_amount DESC
      LIMIT ?`;
    
    db.query(sql, [cardId, limit], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows);
    });
  }

  /**
   * 8. Delete/Void a Transaction
   * Note: In banking, we usually don't delete. We "Refund" or "Reverse".
   * This is provided for administrative cleanup.
   */
  static delete(txId, callback) {
    const sql = "DELETE FROM card_transactions WHERE card_tx_id = ?";
    db.query(sql, [txId], (err, result) => {
      if (err) return callback(err);
      callback(null, result.affectedRows > 0);
    });
  }
}

module.exports = CardTransactionModel;