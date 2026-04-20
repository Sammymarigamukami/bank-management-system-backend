const { jwtauth } = require('../middleware/jwt');
const { isManager } = require('../middleware/middleware');

module.exports = (app) => {
  const onlineLoans = require('../controllers/loanController');
  const createLoanTypes = require('../controllers/loanTypeController');
  const { connectCloudinary } = require('../config/cloudinary');
  const { upload } = require('../config/multer');
  connectCloudinary();

  const router = require('express').Router();

  router.post('/api/apply/physical', [jwtauth], onlineLoans.requestPhysicalLoan);
  router.post(
    '/api/apply/online', 
    [
      jwtauth, 
      upload.fields([
        { name: 'idDocument', maxCount: 1 },
        { name: 'bankStatement', maxCount: 1 }
      ])
    ], 
    onlineLoans.applyForOnlineLoan);
  router.get('/api/loans/payment', [jwtauth], onlineLoans.payLoanInstallment);
  router.get('/api/loans/installments/:loanId', [jwtauth], onlineLoans.getLoanInstallments);
  router.get('/api/loans/eligible-collateral', [jwtauth], onlineLoans.getEligibleCollateral);
  router.get('/api/loans/types', [jwtauth], onlineLoans.getLoanTypes);
  router.post('/api/loans/create/types', [jwtauth], createLoanTypes.createLoanType);
  router.put('/api/loans/update/:id', [jwtauth], createLoanTypes.updateLoanType);
  router.delete('/api/loans/delete/:id', [jwtauth], createLoanTypes.deleteProduct);
  router.patch('/api/loans/toggle-status/:id', [jwtauth], createLoanTypes.setOnlineStatus);
  router.get('/api/customer/loans', [jwtauth], onlineLoans.getCustomerLoans);
  router.get('/api/loans/all', [jwtauth], onlineLoans.getAllLoans);
  router.get('/api/loans/:id', onlineLoans.getLoanDetails);

  app.use('/Loans', router);
};
