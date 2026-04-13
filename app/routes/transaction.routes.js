module.exports = (app) => {
  const { jwtauth } = require('../middleware/jwt');

  const router = require('express').Router();
  const transactionController = require('../controllers/getTransactionHistoryController.js');
  const downloadReport = require('../controllers/reportTransactionController.js');

  router.get('/customer/:customerId',  transactionController.getUserHistory);
  router.get('/admin/all', transactionController.getAdminTransactions);
  router.get('/customer/:customerId/analytics', transactionController.getCustomerAnalytics);
  router.get('/api/admin/reports/daily',jwtauth, downloadReport.downloadDailyAdminReport);
  router.get('/api/admin/reports/monthly', jwtauth, downloadReport.downloadMonthlyAdminReport);
  app.use('/transactions', router);
};
  