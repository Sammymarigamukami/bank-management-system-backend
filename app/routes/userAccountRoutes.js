
module.exports = (app) => {
    const accountTransferController = require('../controllers/internalAccountTransferController.js');
    const router = require('express').Router(); 

    router.post('/api/transfer', accountTransferController.transfer);

    app.use('/user', router);
}