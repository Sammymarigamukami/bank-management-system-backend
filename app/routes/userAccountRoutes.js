const { jwtauth } = require('../middleware/jwt.js');

module.exports = (app) => {
    const accountTransferController = require('../controllers/internalAccountTransferController.js');
    const depositController = require('../controllers/mpesaController/stkPushController.js');
    const callBackController = require('../controllers/mpesaController/handleCallbackController.js');
    const getBalances = require('../controllers/accountController.js');
    const getStatus = require('../controllers/mpesaController/mpesaStatusController.js')
    const cardActions = require('../controllers/cardActionsController.js');
    
    const router = require('express').Router(); 

    router.post('/api/transfer', accountTransferController.transfer);
    router.post('/api/deposit', jwtauth, depositController.initializeSTKPush);
    router.post('/api/deposit/callback', callBackController.handleStkPushCallback);
    router.get('/api/getBalance', [jwtauth], getBalances.getActiveAccounts);
    router.get('/api/deposit/status/:checkoutRequestId', jwtauth, getStatus.getTransactionStatus);
    router.post('/api/accounts/transfer/customer', jwtauth, getBalances.transferFundsByCustomerID);
    router.post('/api/accounts/transfer/account', jwtauth, getBalances.transferFundByAccountID);
    router.post('/api/accounts/card/createCard', jwtauth, cardActions.issueNewCard);
    router.get('/api/accounts/getCardDetails/:card_id', jwtauth, cardActions.getCardDetails);
    router.post('/api/accounts/card/freeze', jwtauth, cardActions.freezeCard);
    router.post('/api/accounts/card/unfreeze', jwtauth, cardActions.unfreezeCard);
    // router.post('/api/accounts/card/transaction', jwtauth, cardActions.authorizeCardTransaction);

    app.use('/user', router);
}