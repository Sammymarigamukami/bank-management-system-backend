const onlineCustomers = require('../models/online.customer.model.js');
const onlineEmployee = require('../models/employee.model.js');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

exports.customerLogin = (req, res) => {
  const userName = req.body.loginDetails.userName;
  const password = req.body.loginDetails.password;
  const bcrypt = require('bcrypt');

onlineCustomers.findByUsername(userName, (err, data) => {

    if (err) {
      if (err.kind === 'not_found') {
        return res.status(404).send({
          auth: 'fail',
          message: 'User not found',
        });
      }
      return res.status(500).send({
        auth: 'fail',
        message: 'Error retrieving user',
      });
    }

    const hash = data.password_hash;

    bcrypt.compare(password, hash, (err, result) => {

      if (err) {
        return res.status(500).send({
          auth: 'fail',
          message: 'Error comparing password',
        });
      }

      if (!result) {
        return res.status(401).send({
          auth: 'fail',
          message: 'Incorrect Password',
        });
      }

      const token = jwt.sign(
        { customerID: data.customer_id, role: 'customer' }, // 🔥 FIXED
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      return res.send({
        auth: 'success',
        role: 'customer',
        expires: '2h',
        email: data.email,
        customerID: data.customer_id,
        userName,
        token,
      });
    });
  });
};

exports.employeeLogin = (req, res) => {
  console.log('in auth controller');
  console.log('req body: ', req.body.loginDetails);
  const userName = req.body.loginDetails.userName;
  const password = req.body.loginDetails.password;
  const bcrypt = require('bcrypt');

  onlineEmployee.findByUsername(userName, (err, data) => {
    if (err.kind === 'not_found') {
      res.status(404).send({
        auth: 'fail',
        message: 'User not found',
      });
    } else if (err.kind === 'error') {
      res.status(500).send({
        auth: 'fail',
        message: 'Error retrieving user',
      });
    } else {
      hash = data.Password;
      bcrypt.compare(password, hash, function (err, result) {
        if (err === 'error') {
          res.status(500).send({
            auth: 'fail',
            message: 'Error retrieving user',
          });
        } else if (result === true) {
          const role = data.isManager ? 'manager' : 'employee';
          const token = jwt.sign({ ...data, role: role }, JWT_SECRET, {
            expiresIn: '2h',
          });
          const employeeID = data.EmployeeID;
          const branchID = data.BranchID;

          res.send({
            auth: 'success',
            role: role,
            employeeID,
            branchID,
            userName,
            token,
          });
          console.log('login successful, token generated: ', token);
        } else {
          res.status(401).send({ auth: 'fail', message: 'Incorrect Password' });
        }
      });
    }
  });
};

exports.createOnlineCustomer = (req, res) => {

  if (!req.body) {
    return res.status(400).json({
      message: 'Online customer details are required',
    })
  }

  console.log('creating online customer with details: ', req.body);
  const onlineCustomer = req.body;
  console.log("online customer details: ", onlineCustomer);

  onlineCustomers.create(onlineCustomer, (err, data) => {
    if (err) {
      if (err.kind === 'username_or_email_exists') {
        return res.status(409).json({ message: err.message });
      }
      if (err.kind ===  'username_does_not_exist') {
        return res.status(400).json({ message: err.message });
      }

      if (
        err.message === "Invalid username format" ||
        err.message === "Invalid email format" ||
        err.message.includes("Password must")
      ) {
        return res.status(400).json({ message: err.message });
      }

      if (err.message === "Customer does not exist") {
        return res.status(404).json({ message: err.message });
      }

      return res.status(500).json({ message: 'Internal server error'});
    } else {
      const customerID = data.customerID;
      const userName = data.Username;
      const email = data.Email;
      const phone = data.Phone;
      const firstName = data.FirstName;
      const lastName = data.LastName;
      const token = jwt.sign({ ...data, role: 'customer' }, JWT_SECRET, {
        expiresIn: '2h',
      });

      res.send({
        auth: 'success',
        role: 'customer',
        expires: '2h',
        email,
        customerID,
        userName,
        phone,
        firstName,
        lastName,
        token,
      })
    }
  });
};
