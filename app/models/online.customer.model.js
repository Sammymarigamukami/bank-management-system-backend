const generateAccountNumber = require('../utils/accountNumberGenerator.js');
const { normalizeMsisdn } = require('../utils/phoneNormalize.js');
const AccountModel = require('./userAccountModel.js');
const sql = require('./db.js');
const RoleModel = require('./roleModel.js');
const CustomerRoleModel = require('./customerRoleModel.js');

const OnlineCustomer = function (onlineCustomer) {
  this.CustomerID = onlineCustomer.customerID;
  this.Username = onlineCustomer.username;
  this.Password = onlineCustomer.password;
};

OnlineCustomer.create = async (newOnlineCustomer, result) => {
  const bcrypt = require('bcrypt');
  const saltRounds = 10;

  try {
    if (
      !newOnlineCustomer.Username ||
      !newOnlineCustomer.Email ||
      !newOnlineCustomer.Password ||
      !newOnlineCustomer.Phone ||
      !newOnlineCustomer.FirstName ||
      !newOnlineCustomer.LastName
    ) {
      return result({ kind: 'validation_error', message: 'Missing required fields' }, null);
    }

    const username = newOnlineCustomer.Username.trim().toLowerCase();
    const email = newOnlineCustomer.Email.trim().toLowerCase();
    const password = newOnlineCustomer.Password;
    const phone = normalizeMsisdn(newOnlineCustomer.Phone);
    const firstName = newOnlineCustomer.FirstName.trim();
    const lastName = newOnlineCustomer.LastName.trim();

    const usernameRegex = /^[a-zA-Z0-9_]{3,12}$/;
    if (!usernameRegex.test(username)) {
      return result({ kind: 'invalid_username', message: 'Invalid username format' }, null);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return result({ kind: 'invalid_email', message: 'Invalid email format' }, null);
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return result({
        kind: 'invalid_password',
        message: 'Weak password'
      }, null);
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const customerData = {
      username,
      email,
      password_hash: hashedPassword,
      phone,
      first_name: firstName,
      last_name: lastName
    };

    sql.query("INSERT INTO customers SET ?", customerData, (err, res1) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return result({ kind: 'duplicate', message: 'Username or email exists' }, null);
        }
        return result({ kind: 'error', message: 'Customer creation failed' }, null);
      }

      const customerID = res1.insertId;

      const accountNumber = generateAccountNumber();

      const accountData = {
        customer_id: customerID,
        account_number: accountNumber,
        account_type: 'current',
        status: 'not_active'
      };

      sql.query("INSERT INTO accounts SET ?", accountData, (err, res2) => {
        if (err) {
          return result({ kind: 'error', message: 'Account creation failed' }, null);
        }

        AccountModel.updateAccountStatus(res2.insertId, 'active', (err) => {
          if (err) {
            return result({ kind: 'error', message: 'Account activation failed' }, null);
          }

          RoleModel.findByName('customer', (err, role) => {
            if (err || !role) {
              return result({ kind: 'error', message: 'Customer role not found' }, null);
            }

            CustomerRoleModel.assignRole(customerID, role.role_id, null, (err) => {
              if (err) {
                return result({ kind: 'error', message: 'Role assignment failed' }, null);
              }

              return result(null, {
                kind: 'success',
                message: 'Customer created successfully',
                customerID,
                username,
                email,
                phone,
                firstName,
                lastName,
                accountNumber,
                role: role.role_name
              });
            });
          });
        });
      });
    });

  } catch (error) {
    return result({ kind: 'error', message: 'Server error' }, null);
  }
};

OnlineCustomer.findByUsername = (username, result) => {
  console.log('in findUser');
  console.log("username:", username);
  const query = `SELECT * FROM customers WHERE username = ?`;
  sql.query(query, username, (err, res) => {
    console.log("query result: ", res);
    if (err) {
      console.log('error: ', err);
      result({ kind: 'error', ...err }, null);
      return;
    }

    if (res.length) {
      console.log(query);
      console.log('found online customer: ', res[0]);
      result({ kind: 'success' }, res[0]);
    } else {
      result({ kind: 'not_found' }, null);
    }
  });
};

OnlineCustomer.findById = (customer_id, result) => {
  console.log("in findById");
  console.log("customer_id:", customer_id);

  const query = `SELECT * FROM customers WHERE customer_id = ?`;

  // IMPORTANT: wrap param in array
  sql.query(query, [customer_id], (err, res) => {
    console.log("query result:", res);

    if (err) {
      console.log("error:", err);
      return result({ kind: "error", ...err }, null);
    }

    if (res.length) {
      console.log("found customer:", res[0]);
      return result({ kind: "success" }, res[0]);
    } else {
      return result({ kind: "not_found" }, null);
    }
  });
};

OnlineCustomer.delete = (id, result) => {
  const query = `DELETE FROM customers WHERE customer_id = ?`;
  sql.query(query, id, (err, res) => {
    if (err) {
      console.log('error: ', err);
      result({ kind: 'error', ...err }, null);
      return;
    }

    if (res.affectedRows === 0) {
      result({ kind: 'not_found' }, null);
      return;
    }

    console.log('deleted online customer with id: ', id);
    result({ kind: 'success' }, res);
  });
};

module.exports = OnlineCustomer;
