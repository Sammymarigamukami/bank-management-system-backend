const { jwtauth } = require('../middleware/jwt.js');

module.exports = (app) => {
    const accountTransferController = require('../controllers/internalAccountTransferController.js');
    const depositController = require('../controllers/mpesaController/stkPushController.js');
    const callBackController = require('../controllers/mpesaController/handleCallbackController.js');
    const getBalances = require('../controllers/accountController.js');
    
    const router = require('express').Router(); 

    router.post('/api/transfer', accountTransferController.transfer);
    router.post('/api/deposit', depositController.initializeSTKPush);
    router.post('/api/deposit/callback', callBackController.handleStkPushCallback);
    router.get('/api/getBalance', [jwtauth], getBalances.getActiveAccounts);

    app.use('/user', router);
}