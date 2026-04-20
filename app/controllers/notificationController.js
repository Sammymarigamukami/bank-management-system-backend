const NotificationModel = require('../models/notificationModel.js');

/**
 * Get all notifications for the logged-in customer
 * GET /api/notifications
 */
exports.getMyNotifications = (req, res) => {
    const customerId = req.user?.customer_id; // From jwtAuth middleware

    NotificationModel.getByCustomerId(customerId, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Error fetching notifications." });
        }
        res.status(200).json({ success: true, data: results });
    });
};

/**
 * Mark a notification as read
 * PATCH /api/notifications/:id/read
 */
exports.markAsRead = (req, res) => {
    const customerId = req.user?.customer_id;
    const notificationId = req.params.id;

    NotificationModel.markAsRead(notificationId, customerId, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Error updating notification." });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Notification not found or unauthorized." });
        }
        res.status(200).json({ success: true, message: "Notification marked as read." });
    });
};

/**
 * Delete a specific notification
 * DELETE /api/notifications/:id
 */
exports.deleteNotification = (req, res) => {
    const customerId = req.user?.customer_id;
    const notificationId = req.params.id;

    NotificationModel.deleteById(notificationId, customerId, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Error deleting notification." });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Notification not found or unauthorized." });
        }
        res.status(200).json({ success: true, message: "Notification deleted." });
    });
};