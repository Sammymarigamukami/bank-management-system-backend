module.exports = (app) => {
  const { jwtauth } = require('../middleware/jwt');

  const router = require('express').Router();
  const transactionController = require('../controllers/getTransactionHistoryController.js');

  router.get('/customer/:customerId',  transactionController.getUserHistory);
  router.get('/admin/all', transactionController.getAdminTransactions);
  router.get('/customer/:customerId/analytics', transactionController.getCustomerAnalytics);
  app.use('/transactions', router);
};
  