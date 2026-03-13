module.exports = (app) => {
  const auth = require('../controllers/authController.js');


  const router = require('express').Router();

  router.post('/register/onlineAccount', auth.createOnlineCustomer);

  router.post('/employee', auth.employeeLogin);
  router.post('/customer', auth.customerLogin);

  app.use('/login', router);
};
