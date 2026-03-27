module.exports = (app) => {
  const employee = require('../controllers/employeeController');
  const create = require('../controllers/authController')
  const { jwtauth } = require('../middleware/jwt');
  const { isManager } = require('../middleware/middleware');
  const router = require('express').Router();

  router.post('/create', [jwtauth, isManager], employee.create);

  router.get('/', [jwtauth, isManager], employee.getAll);
  router.post('/register', create.createEmployee);

  app.use('/employees', router);
};
