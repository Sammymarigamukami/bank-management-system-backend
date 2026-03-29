

module.exports = (app) => {
    const adminStatsController = require('../controllers/adminStatsController.js');
    const getFullProfile = require('../controllers/adminController.js');
    const getActiveAccountsReport = require('../controllers/adminController.js');
    const router = require('express').Router();

    router.get('/api/dashboard', adminStatsController.getAdminDashboardData);
    router.get('/api/customers/:customerId', getFullProfile.getCustomerFullProfile);
    router.get('/api/customers', getFullProfile.findAll);
    router.get('/api/reports/active-accounts', getActiveAccountsReport.getAccountReport);

    app.use('/admin', router);
}