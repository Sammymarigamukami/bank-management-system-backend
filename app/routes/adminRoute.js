const { jwtauth } = require('../middleware/jwt.js');

module.exports = (app) => {
    const adminStatsController = require('../controllers/adminStatsController.js');
    const getFullProfile = require('../controllers/adminController.js');
    const getActiveAccountsReport = require('../controllers/adminController.js');
    const userAccount = require('../controllers/accountController.js');
    const router = require('express').Router();

    router.get('/api/dashboard', adminStatsController.getAdminDashboardData);
    router.get('/api/customers/:customerId', getFullProfile.getCustomerFullProfile);
    router.get('/api/customers', getFullProfile.findAll);
    router.get('/api/reports/active-accounts', getActiveAccountsReport.getAccountReport);
    router.patch('/api/accounts/update-status/:accountId', jwtauth, userAccount.updateStatus);
    router.patch('/api/accounts/activate/business/:customerID/:accountType', jwtauth, userAccount.activateAccounts);
    router.patch('/api/accounts/close/savings/:accountId', jwtauth, userAccount.closeSavingsAccount);
    router.patch('/api/accounts/close/business/:accountId', jwtauth, userAccount.closeBusinessAccount);

    app.use('/admin', router);
}