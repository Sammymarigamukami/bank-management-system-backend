const { jwtauth } = require('../middleware/jwt.js');

module.exports = (app) => {
    const accountTransferController = require('../controllers/internalAccountTransferController.js');
    const depositController = require('../controllers/mpesaController/stkPushController.js');
    const callBackController = require('../controllers/mpesaController/handleCallbackController.js');
    const getBalances = require('../controllers/accountController.js');
    const getStatus = require('../controllers/mpesaController/mpesaStatusController.js')
    const cardActions = require('../controllers/cardActionsController.js');
    const PaybillController = require('../controllers/payBillController.js');
    const analyticsController = require('../controllers/analyticsController.js');
    
    const router = require('express').Router(); 

    router.post('/api/transfer', jwtauth, accountTransferController.transfer);
    router.post('/api/deposit', jwtauth, depositController.initializeSTKPush);
    router.post('/api/deposit/callback', callBackController.handleStkPushCallback);
    router.get('/api/getBalance', jwtauth, getBalances.getActiveAccounts);
    router.get('/api/deposit/status/:checkoutRequestId', jwtauth, getStatus.getTransactionStatus);
    router.post('/api/accounts/transfer/customer', jwtauth, getBalances.transferFundsByCustomerID);
    router.post('/api/accounts/transfer/account', jwtauth, getBalances.transferFundByAccountNumber);
    router.post('/api/accounts/card/createCard', jwtauth, cardActions.issueNewCard);
    router.get('/api/accounts/getCardDetails/:card_id', jwtauth, cardActions.getCardDetails);
    router.post('/api/accounts/card/freeze', jwtauth, cardActions.freezeCard);
    router.post('/api/accounts/card/unfreeze', jwtauth, cardActions.unfreezeCard);
    //router.post('/api/accounts/card/transaction', jwtauth, cardActions.validateCardTransaction);
    router.get('/api/accounts/card/customer/all', jwtauth, cardActions.getCustomerCards);
    router.delete('/api/accounts/card/delete/:card_id', jwtauth, cardActions.deleteCard);
    router.post('/api/accounts/paybill', jwtauth, PaybillController.PaybillController);
    router.get('/api/accounts/paybill/history', jwtauth, PaybillController.getPaymentHistory);
    router.get('/api/accounts/analysis/:customerId', analyticsController.getDashboardAnalytics);

    app.use('/user', router);
}