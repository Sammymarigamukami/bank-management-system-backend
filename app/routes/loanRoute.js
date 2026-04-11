const { jwtauth } = require('../middleware/jwt');
const { isManager } = require('../middleware/middleware');

module.exports = (app) => {
  const onlineLoans = require('../controllers/loanController');

  const router = require('express').Router();

  router.post('/api/apply/physical', [jwtauth], onlineLoans.requestPhysicalLoan);
  router.post('/api/apply/online', [jwtauth], onlineLoans.applyOnlineLoan);
  router.get('/api/loans/my', [jwtauth], onlineLoans.getCustomerLoans);
  router.get('/api/loans/payment', [jwtauth], onlineLoans.payLoanInstallment);
  router.get('/api/loans/installments/:loanId', [jwtauth], onlineLoans.getLoanInstallments);
  router.get('/api/loans/eligible-collateral', [jwtauth], onlineLoans.getEligibleCollateral);
  router.get('/api/loans/types', [jwtauth], onlineLoans.getLoanTypes);

  app.use('/Loans', router);
};
