const { jwtauth } = require('../middleware/jwt');

module.exports = (app) => {
  const fds = require('../controllers/fdAccountController');

  const router = require('express').Router();

  router.post('/api/fd/create', [jwtauth], fds.createFD);
  router.get('/api/fd/eligible', [jwtauth], fds.getEligibleFDs);
  router.get('/api/fd/my-portfolio', [jwtauth], fds.getMyFDs);
  router.get('/api/fd/:id', [jwtauth], fds.getFDDetails);

  app.use('/user', router);
};
