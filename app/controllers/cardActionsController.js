const db = require("../models/db.js");
const CardModel = require("../models/cardModel");

const generateCardNumber = () => {
  let result = '4'; // Starting with 4 for Visa simulation
  for (let i = 0; i < 15; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
};


const generateExpiryDate = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 3);
  return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
};


exports.issueNewCard = (req, res) => {
    console.log("Issuing new card with request body:", req.user);
  const { account_id } = req.user;
  const { card_type } = req.body;
  console.log("Issuing card for Account ID:", account_id, "Card Type:", card_type);

  if (!account_id || !card_type) {
    return res.status(400).json({
      success: false,
      message: "accountId and card_type (debit/credit) are required."
    });
  }

  const newCardData = {
    account_id: account_id,
    card_number: generateCardNumber(),
    card_type,
    expiry_date: generateExpiryDate()
  };

  CardModel.create(newCardData, (err, card) => {
    if (err) {
      console.error("[Card Issue Error]", err);
      return res.status(500).json({
        success: false,
        message: "Failed to issue new card. Please try again."
      });
    }

    res.status(201).json({
      success: true,
      message: "Card issued successfully.",
      data: card
    });
  });
};


exports.getCardDetails = (req, res) => {
  const { card_id } = req.params;

  // We reuse the getByCardNumber or add a getById if needed. 
  // For now, assuming a generic SQL query for details:
  const sql = "SELECT * FROM cards WHERE card_id = ?";
  db.query(sql, [card_id], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Card not found" });
    }

    res.status(200).json({
      success: true,
      data: rows[0]
    });
  });
};


exports.deleteCard = (req, res) => {
  const { card_id } = req.params;

  CardModel.delete(card_id, (err, success) => {
    if (err) {
      if (err.message === "Card not found") {
        return res.status(404).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: "Error deleting card" });
    }

    res.status(200).json({
      success: true,
      message: "Card has been permanently removed from the system."
    });
  });
};


exports.toggleCardStatus = (req, res) => {
  const { card_id, new_status } = req.body;
  const customer_id = req.user.customer_id;

  if (!['active', 'blocked'].includes(new_status)) {
    return res.status(400).json({ success: false, message: "Invalid status. Use 'active' or 'blocked'." });
  }

  const ownershipSql = `
    SELECT c.card_id FROM cards c
    JOIN accounts a ON c.account_id = a.account_id
    WHERE c.card_id = ? AND a.customer_id = ?`;

  db.query(ownershipSql, [card_id, customer_id], (err, rows) => {
    if (err || rows.length === 0) return res.status(403).json({ success: false, message: "Unauthorized" });

    CardModel.updateStatus(card_id, new_status, (err) => {
      if (err) return res.status(500).json({ success: false, message: "Update failed" });
      res.status(200).json({ 
        success: true, 
        message: `Card is now ${new_status === 'active' ? 'Unfrozen' : 'Frozen'}.`,
        status: new_status 
      });
    });
  });
};


exports.reportLostOrStolen = (req, res) => {
  const { card_id } = req.body;
  const customer_id = req.user.customer_id;

  const sql = "SELECT c.card_id FROM cards c JOIN accounts a ON c.account_id = a.account_id WHERE c.card_id = ? AND a.customer_id = ?";
  
  db.query(sql, [card_id, customer_id], (err, rows) => {
    if (err || rows.length === 0) return res.status(403).json({ success: false, message: "Unauthorized" });

    CardModel.updateStatus(card_id, 'blocked', (err) => {
      if (err) return res.status(500).json({ success: false, message: "Error blocking card" });
      
      res.status(200).json({
        success: true,
        message: "Card reported lost/stolen and blocked. Replacement initiated.",
        ticket_id: `SEC-${Date.now()}`
      });
    });
  });
};


exports.validateCardForTransaction = (req, res) => {
  const { card_number, expiry_date, amount } = req.body;

  const sql = `
    SELECT c.status, c.expiry_date, a.balance 
    FROM cards c
    JOIN accounts a ON c.account_id = a.account_id
    WHERE c.card_number = ?`;

  db.query(sql, [card_number], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "System error" });
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Card not recognized" });

    const card = rows[0];
    const today = new Date();
    const expiry = new Date(card.expiry_date);

    if (card.status !== 'active') {
      return res.status(403).json({ success: false, message: `Declined: Card is ${card.status}` });
    }

    if (expiry < today) {
      return res.status(403).json({ success: false, message: "Declined: Card expired" });
    }

    if (parseFloat(card.balance) < parseFloat(amount)) {
      return res.status(403).json({ success: false, message: "Declined: Insufficient funds" });
    }

    res.status(200).json({ success: true, message: "Transaction Authorized" });
  });
};

exports.freezeCard = (req, res) => {
  const { card_id } = req.body;
  const customer_id = req.user.customer_id;

  if (!card_id) {
    return res.status(400).json({ success: false, message: "card_id is required." });
  }

  // Check ownership AND current status
  const ownershipSql = `
    SELECT c.card_id, c.status FROM cards c
    JOIN accounts a ON c.account_id = a.account_id
    WHERE c.card_id = ? AND a.customer_id = ?`;

  db.query(ownershipSql, [card_id, customer_id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    if (rows.length === 0) return res.status(403).json({ success: false, message: "Unauthorized: You do not own this card." });

    const currentStatus = rows[0].status;

    // VALIDATION: Check if already frozen
    if (currentStatus === 'blocked') {
      return res.status(400).json({ 
        success: false, 
        message: "This card is already frozen/blocked." 
      });
    }

    if (currentStatus === 'expired') {
      return res.status(400).json({ 
        success: false, 
        message: "This card is expired and cannot be frozen manually." 
      });
    }

    CardModel.updateStatus(card_id, 'blocked', (err) => {
      if (err) return res.status(500).json({ success: false, message: "Failed to freeze card" });
      res.status(200).json({ 
        success: true, 
        message: "Card has been frozen successfully. Transactions are now disabled.",
        status: 'blocked' 
      });
    });
  });
};


exports.unfreezeCard = (req, res) => {
  const { card_id } = req.body;
  const customer_id = req.user.customer_id;

  if (!card_id) {
    return res.status(400).json({ success: false, message: "card_id is required." });
  }

  // Check ownership AND current status
  const ownershipSql = `
    SELECT c.card_id, c.status FROM cards c
    JOIN accounts a ON c.account_id = a.account_id
    WHERE c.card_id = ? AND a.customer_id = ?`;

  db.query(ownershipSql, [card_id, customer_id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    if (rows.length === 0) return res.status(403).json({ success: false, message: "Unauthorized: You do not own this card." });

    const currentStatus = rows[0].status;

    // VALIDATION: Check if already active
    if (currentStatus === 'active') {
      return res.status(400).json({ 
        success: false, 
        message: "This card is already active." 
      });
    }

    if (currentStatus === 'expired') {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot unfreeze an expired card." 
      });
    }

    CardModel.updateStatus(card_id, 'active', (err) => {
      if (err) return res.status(500).json({ success: false, message: "Failed to unfreeze card" });
      res.status(200).json({ 
        success: true, 
        message: "Card has been unfrozen. You can now use it for transactions.",
        status: 'active' 
      });
    });
  });
};
