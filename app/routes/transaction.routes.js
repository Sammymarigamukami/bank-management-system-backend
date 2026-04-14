module.exports = (app) => {
  const { jwtauth } = require('../middleware/jwt');

  const router = require('express').Router();
  const transactionController = require('../controllers/getTransactionHistoryController.js');
  const downloadReport = require('../controllers/reportTransactionController.js');
  const downloadCustomerList = require('../controllers/reportCustomerController.js');

  router.get('/customer/:customerId',  transactionController.getUserHistory);
  router.get('/admin/all', transactionController.getAdminTransactions);
  router.get('/customer/:customerId/analytics', transactionController.getCustomerAnalytics);
  router.get('/api/admin/reports/transactions',jwtauth, downloadReport.downloadAdminReport);
  router.get('/api/admin/reports/customers', jwtauth, downloadCustomerList.downloadCustomerList);
  app.use('/transactions', router);
};
  