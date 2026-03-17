const { jwtauth } = require('../middleware/jwt.js');

module.exports = (app) => {
  const auth = require('../controllers/authController.js');
  const isAuth = require('../controllers/isAuthController.js');


  const router = require('express').Router();

  router.post('/register/onlineAccount', auth.createOnlineCustomer);

  router.post('/employee', auth.employeeLogin);
  router.post('/customer', auth.customerLogin);
  router.get('/user-auth', [jwtauth], isAuth.userAuth);

  app.use('/login', router);
};
