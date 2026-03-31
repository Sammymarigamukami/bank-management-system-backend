const db = require("./db.js");

class CardModel {
  /**
   * 1. Create a new Card
   */
  static create(cardData, callback) {
    const { account_id, card_number, card_type, expiry_date } = cardData;
    const sql = `INSERT INTO cards (account_id, card_number, card_type, expiry_date, status) 
                 VALUES (?, ?, ?, ?, 'active')`;
    
    db.query(sql, [account_id, card_number, card_type, expiry_date], (err, result) => {
      if (err) return callback(err);
      callback(null, { card_id: result.insertId, ...cardData });
    });
  }

  /**
   * 2. Get all cards belonging to a specific Account
   */
  static getByAccountId(accountId, callback) {
    const sql = "SELECT * FROM cards WHERE account_id = ?";
    db.query(sql, [accountId], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows);
    });
  }

  /**
   * 3. Get all cards belonging to a specific Customer (Joins accounts table)
   */
  static getByCustomerId(customerId, callback) {
    const sql = `
      SELECT c.*, a.account_number 
      FROM cards c
      JOIN accounts a ON c.account_id = a.account_id
      WHERE a.customer_id = ?`;
    
    db.query(sql, [customerId], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows);
    });
  }

  /**
   * 4. Find a specific card by its unique Card Number
   */
  static getByCardNumber(cardNumber, callback) {
    const sql = "SELECT * FROM cards WHERE card_number = ?";
    db.query(sql, [cardNumber], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0] || null);
    });
  }

  /**
   * 5. Update Card Status (Block, Activate, Expire)
   */
  static updateStatus(cardId, status, callback) {
    const allowedStatuses = ['active', 'blocked', 'expired'];
    if (!allowedStatuses.includes(status)) {
      return callback(new Error("Invalid status provided"));
    }

    const sql = "UPDATE cards SET status = ? WHERE card_id = ?";
    db.query(sql, [status, cardId], (err, result) => {
      if (err) return callback(err);
      if (result.affectedRows === 0) return callback(new Error("Card not found"));
      callback(null, { message: `Card status updated to ${status}` });
    });
  }

  /**
   * 6. Helper: Block a card (Specific Business Case)
   */
  static blockCard(cardId, callback) {
    this.updateStatus(cardId, 'blocked', callback);
  }

  /**
   * 7. Check if a card is active before allowing a transaction
   */
  static isCardActive(cardNumber, callback) {
    const sql = "SELECT status FROM cards WHERE card_number = ?";
    db.query(sql, [cardNumber], (err, rows) => {
      if (err) return callback(err);
      if (rows.length === 0) return callback(new Error("Card not found"));
      
      const isActive = rows[0].status === 'active';
      callback(null, isActive);
    });
  }

  /**
   * 8. Delete a card (Permanent removal)
   */
  static delete(cardId, callback) {
    const sql = "DELETE FROM cards WHERE card_id = ?";
    db.query(sql, [cardId], (err, result) => {
      if (err) return callback(err);
      if (result.affectedRows === 0) return callback(new Error("Card not found"));
      callback(null, { message: "Card deleted successfully" });
    });
  }

  /**
   * 9. Get Count of Cards per Account
   */
  static getCardCountByAccount(accountId, callback) {
    const sql = "SELECT COUNT(*) as cardCount FROM cards WHERE account_id = ?";
    db.query(sql, [accountId], (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0].cardCount);
    });
  }

  /**
   * 10. NEW: Get All Cards (Administrative View)
   * Retrieves every card record in the system
   */
  static getAllCards(callback) {
    const sql = "SELECT * FROM cards ORDER BY created_at DESC";
    db.query(sql, (err, rows) => {
      if (err) return callback(err);
      callback(null, rows);
    });
  }
}

module.exports = CardModel;