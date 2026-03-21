const generateAccountNumber = require('../utils/accountNumberGenerator.js');
const { normalizeMsisdn } = require('../utils/phoneNormalize.js');
const AccountModel = require('./userAccountModel.js');
const sql = require('./db.js');

const OnlineCustomer = function (onlineCustomer) {
  this.CustomerID = onlineCustomer.customerID;
  this.Username = onlineCustomer.username;
  this.Password = onlineCustomer.password;
};

OnlineCustomer.create = async (newOnlineCustomer, result) => {

  const bcrypt = require('bcrypt');
  const saltRounds = 10; // Number of salt rounds for bcrypt hashing

  console.log('creating online customer: ', newOnlineCustomer);

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


    console.log('creating online customer with username: ', username, ' email: ', email);
    // Validate Username
    const usernameRegex = /^[a-zA-Z0-9_]{3,12}$/;
    if (!usernameRegex.test(username)) {
      return result({ kind: 'invalid_username', message: 'Invalid username format' }, null);
    }

    // Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return result({ kind: 'invalid_email', message: 'Invalid email format' }, null);
    }

    // strong password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return result({ kind: 'invalid_password', 
        message: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character' }, 
        null);
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const data = {
      username: username,
      email: email,
      password_hash: hashedPassword,
      phone: phone,
      first_name: firstName,
      last_name: lastName
    };

    sql.query("INSERT INTO customers SET ?", data, (err, res) => {
      if (err) {
        console.log('error: ', err);
        if (err.code === "ER_DUP_ENTRY") {
        return result({ kind: 'username_or_email_exists', message: 'Username or email already exists' }, null);
        }
       return result({ message: "Database error"} , null);
      }
      const customerID = res.insertId;
      const responseData = {
        customerID,
        Username: username,
        Email: email,
        Phone: phone,
        FirstName: firstName,
        LastName: lastName
      };
      console.log('created online customer: ', responseData);

      // create current account for new user
      const accountNumber = generateAccountNumber();
      const accountData = {
        customer_id: customerID,
        account_number: accountNumber,
        account_type: 'current',
        status: 'not_active',
      }

      sql.query("INSERT INTO accounts SET ?", accountData, (err, res2) => {
        if (err) {
          console.log('error creating account for customers: ', err);
          return result({ message: 'Error creating account for customer' }, null);
        }

        // Activate account immediately after creation
        AccountModel.updateAccountStatus(res2.insertId, 'active', (err, res3)=> {
          if (err) {
            console.log('error activating account for customer: ', err);
            return result({ message: 'Error activating account for new customer'}, null);
          }
          console.log('account created and activated for new customer with ID: ', accountNumber);
        result(null, {
           ...responseData,
           accountData 
        })
      })
      });
    })
  } catch (error) {
    result({ kind: 'error', message: 'Error creating online customer' }, null);
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
