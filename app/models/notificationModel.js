const db = require('./db.js'); // Assuming your DB connection is here

class NotificationModel {
  /**
   * Send a notification to a specific customer account.
   * @param {number} customerId - The unique ID of the customer.
   * @param {string} message - The content of the notification.
   * @param {function} callback - Results callback.
   */
  static create(customerId, message, callback) {
    const sql = `
      INSERT INTO notifications (customer_id, message)
      VALUES (?, ?)
    `;
    db.query(sql, [customerId, message], (err, result) => {
      if (err) {
        console.error("Error creating individual notification:", err);
        return callback(err);
      }
      callback(null, result);
    });
  }

  /**
   * Broadcast a notification to ALL registered customer accounts.
   * Logic: Sub-queries all customer IDs and inserts a notification record for each.
   * @param {string} message - The content of the notification.
   * @param {function} callback - Results callback.
   */
  static broadcast(message, callback) {
    // This query inserts a notification for every entry in the customers table
    const sql = `
      INSERT INTO notifications (customer_id, message)
      SELECT customer_id, ? FROM customers
    `;
    db.query(sql, [message], (err, result) => {
      if (err) {
        console.error("Error broadcasting notifications:", err);
        return callback(err);
      }
      callback(null, result);
    });
  }

  /**
   * Delete a specific notification by its ID.
   * Safety measure: Requires customerId to ensure the user owns the notification.
   */
  static deleteById(notificationId, customerId, callback) {
    const sql = `
      DELETE FROM notifications 
      WHERE notification_id = ? AND customer_id = ?
    `;
    db.query(sql, [notificationId, customerId], (err, result) => {
      if (err) {
        console.error("Error deleting notification:", err);
        return callback(err);
      }
      callback(null, result);
    });
  }

  /**
   * Fetch notifications for a specific user to display in their dashboard.
   */
  static getByCustomerId(customerId, callback) {
    const sql = `
      SELECT * FROM notifications 
      WHERE customer_id = ? 
      ORDER BY created_at DESC
    `;
    db.query(sql, [customerId], (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  }

  /**
   * Mark a notification as read.
   */
  static markAsRead(notificationId, customerId, callback) {
    const sql = `
      UPDATE notifications 
      SET is_read = TRUE 
      WHERE notification_id = ? AND customer_id = ?
    `;
    db.query(sql, [notificationId, customerId], (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  }

  /**
   * Delete old notifications (maintenance).
   */
  static deleteOld(days, callback) {
    const sql = `
      DELETE FROM notifications 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    db.query(sql, [days], callback);
  }
}



module.exports = NotificationModel;