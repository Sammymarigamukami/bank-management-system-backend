const { isAccountOwnedByCustomer } = require('../middleware/middleware.js');
const AccountModel = require('../models/account.model');
const GetBalance = require('../models/userAccountModel.js');

// Retrieve all accounts for a customer or all accounts
exports.findAll = (req, res) => {
  //console.log(req.params);
  const customerID = req.user.CustomerID;
  AccountModel.getAll(customerID, req, (err, data) => {
    if (err.kind === 'not_found') {
      res.status(404).send({
        message: `No accounts found for customer ${customerID}.`,
      });
    } else if (err.kind != 'success') {
      res.status(500).send({
        message:
          err.message || 'Some error occurred while retrieving accounts.',
      });
    } else res.send(data);
  });
};

// Retrieve an account by ID
exports.getFromID = (req, res) => {
  const accountID = req.params.id;
  AccountModel.findById(accountID, req, (err, data) => {
    if (err.kind === 'not_found') {
      res.status(404).send({
        message: `No account found with id ${accountID}.`,
      });
    } else if (err.kind != 'success') {
      res.status(500).send({
        message: err.message || 'Some error occurred while retrieving account.',
      });
    } else if (err.kind === 'access denied') {
      res.status(401).send({
        message: err.message || 'Access Denied to Page',
      });
    } else res.send(data);
  });
};

// Create a new account
exports.create = (req, res) => {
  console.log(req.user.BranchID);
  const account = {
    CustomerID: req.body.account.customerID,
    TypeID: req.body.account.accountType,
    BranchID: req.user.BranchID,
    Balance: req.body.account.initialBalance,
  };
  AccountModel.create(account, req, (err, data) => {
    if (err.kind === 'error') {
      res.status(500).send({
        message: err.message || 'Some error occurred while creating account.',
      });
    } else res.send(data);
  });
};


exports.getActiveAccounts = async (req, res) => {
  const customerID = req.user.customer_id;
  console.log("customerID:", customerID);

  try {
    // Wrap the callback-based function in a Promise
    const accounts = await new Promise((resolve, reject) => {
      GetBalance.getActiveAccounts(customerID, (err, data) => {
        if (err) return reject(err);       // reject the promise on error
        resolve(data);                     // resolve the promise with data
      });
    });

    if (!accounts || accounts.length === 0) {
      return res.status(404).send({
        message: `No active accounts found for customer ${customerID}`
      });
    }

    return res.status(200).send({
      accounts
    });

  } catch (err) {
    return res.status(500).send({
      message: err.message || "Database error"
    });
  }
};