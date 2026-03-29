module.exports = (app) => {
  const { jwtauth } = require('../middleware/jwt');

  const router = require('express').Router();
  const transactionController = require('../controllers/getTransactionHistoryController.js');

  router.get('/customer/:accountId',  transactionController.getUserHistory);
  router.get('/admin/all', transactionController.getAdminTransactions);

  app.use('/transactions', router);
};
  