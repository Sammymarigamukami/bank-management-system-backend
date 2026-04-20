const { jwtauth } = require('../middleware/jwt.js');

module.exports = (app) => {
    const router = require('express').Router();
    const notificationController = require('../controllers/notificationController.js');
    router.get('/api/notifications', jwtauth, notificationController.getMyNotifications);
    router.patch('/api/notifications/:id/read', jwtauth, notificationController.markAsRead);
    router.delete('/api/notifications/:id', jwtauth, notificationController.deleteNotification);

    app.use('/user', router);
}