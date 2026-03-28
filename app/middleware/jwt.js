const jwt = require('jsonwebtoken');
const onlineCustomerModel = require('../models/online.customer.model');
const onlineEmployeeModel = require('../models/employee.model');
// const _ = require("lodash");
require('dotenv').config();


let verifyToken = (token, next) => {
  console.log({ token });
  try {
    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { ...decoded, expired: false };
  } catch (err) {
    if (err) {
      console.log(err);
      if (err.name === 'TokenExpiredError') {
        //console.log('token expired');
        var decoded = jwt.decode(token);
        if (decoded) {
          return { ...decoded, expired: true };
        } else return false;
      } else return false;
    }
  }
};

let tokenValidation = async (req, res, next) => {
  const auth_header = req.headers['authorization'];
  
  if (!auth_header) {
    return res.status(400).json({ status: 400, message: 'User does not have token' });
  }

  try {
    const token = auth_header.split(' ')[1];
    req.token = token;

    const decodedToken = verifyToken(req.token, next);
    console.log("Decoded token:", decodedToken);

    if (!decodedToken) {
      return res.status(400).json({ status: 400, message: 'Invalid token' });
    }

    // FIX: Define roles here so it is available to all blocks below
    const roles = Array.isArray(decodedToken.roles) ? decodedToken.roles : [decodedToken.roles];

    // 1. CUSTOMER LOGIC
    if (roles.includes('customer')) {
      if (decodedToken.expired) {
        // Handle expiration (consider if you really want to refresh here or just force logout)
        return res.status(401).json({ status: 401, message: 'Token Expired' });
      }

      onlineCustomerModel.findById(decodedToken.customerId , (err, user) => {
        console.log("Customer lookup result:", { err, user });
        if (err.kind === 'not_found' || err.kind === 'error' || !user) {
          return res.status(400).json({ status: 400, message: 'Customer not found' });
        }
        let customerData = user;
        customerData.role = 'customer'; // Add role info to user data
        req.user = customerData; // Attach user data to request
        next();
      });

    // 2. EMPLOYEE / MANAGER LOGIC
    } else if (roles.includes('employee') || roles.includes('manager')) {
      if (decodedToken.expired) {
        return res.status(401).json({ status: 401, message: 'Token Expired' });
      }

      // FIX: Ensure you are using the correct field from the token (OnlineID or username)
      onlineEmployeeModel.findByUsername(decodedToken.username, (err, response) => {
        console.log("Employee lookup result:", { err, response });
        if (err.kind === 'not_found' || err.kind === 'error' || !response) {
          return res.status(400).json({ status: 400, message: 'Employee not found' });
        }
        let employeeData = response;
        employeeData.role = roles.includes('manager') ? 'manager' : 'employee';
        req.user = employeeData;
        next();
      });
    } else {
      return res.status(403).json({ status: 403, message: 'Unauthorized role' });
    }

  } catch (err) {
    console.error({ err });
    res.status(400).json({ status: 400, message: 'Error processing token' });
  }
};

module.exports.jwtauth = tokenValidation;
