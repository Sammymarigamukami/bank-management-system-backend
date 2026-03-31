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

  // Updated query to JOIN with the accounts table to get the account_id
  const query = `
    SELECT 
      c.*, 
      a.account_id,
      a.account_number,
      a.balance
    FROM customers c
    LEFT JOIN accounts a ON c.customer_id = a.customer_id
    WHERE c.customer_id = ?
    LIMIT 1`;

  // IMPORTANT: wrap param in array
  sql.query(query, [customer_id], (err, res) => {
    if (err) {
      console.log("error:", err);
      return result({ kind: "error", ...err }, null);
    }

    if (res.length) {
      // The account_id is now included in res[0] thanks to the JOIN
      console.log("found customer with account:", res[0]);
      return result({ kind: "success" }, res[0]);
    } else {
      // Not found
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

OnlineCustomer.countAll = (result) => {
  const query = "SELECT COUNT(*) AS total FROM customers";
  
  sql.query(query, (err, res) => {
    if (err) {
      console.log("error: ", err);
      result(err, null); // Send error to callback
      return;
    }
    
    // Send the actual number to the callback
    result(null, res[0].total); 
  });
};

OnlineCustomer.countActive = (result) => {
  const query = "SELECT COUNT(*) AS active FROM accounts WHERE status = 'active'";
  
  sql.query(query, (err, res) => {
    if (err) {
      console.log("error: ", err);
      // Pass the error to the callback
      result(err, null);
      return;
    }
    
    // Pass the actual count (res[0].active) to the callback
    console.log("Count Active Result:", res[0].active);
    result(null, res[0].active);
  });
};


OnlineCustomer.getFullProfile = (customerId, result) => {
  const query = `
    SELECT 
      /* Overview & Personal Information */
      c.customer_id as customerId,
      CONCAT(c.first_name, ' ', c.last_name) as name,
      c.username,
      c.email,
      c.phone,                       -- Matches your 'phone' column
      c.status,                      -- Matches your ENUM('active','suspended','closed')
      c.created_at as joinedDate,
      
      /* Active Account Details */
      a.account_id,
      a.account_number as accountNumber,
      a.balance as currentBalance,
      a.created_at as accountCreatedAt,
      
      /* Aggregate Financial Stats */
      (SELECT SUM(amount) FROM transactions 
       WHERE account_id = a.account_id AND transaction_type = 'deposit') as totalDeposit,
       
      (SELECT SUM(amount) FROM transactions 
       WHERE account_id = a.account_id AND transaction_type = 'withdrawal') as totalWithdrawal,
       
      (SELECT COUNT(*) FROM transactions 
       WHERE account_id = a.account_id) as transactionCount
       
    FROM customers c
    JOIN accounts a ON c.customer_id = a.customer_id
    WHERE c.customer_id = ? 
    LIMIT 1`;

  sql.query(query, [customerId], (err, res) => {
    if (err) {
      console.error("Error fetching full profile:", err);
      return result(err, null);
    }
    
    if (res.length) {
      // Clean up nulls and ensure numeric types
      const profile = {
        ...res[0],
        currentBalance: parseFloat(res[0].currentBalance || 0),
        totalDeposit: parseFloat(res[0].totalDeposit || 0),
        totalWithdrawal: parseFloat(res[0].totalWithdrawal || 0),
        transactionCount: parseInt(res[0].transactionCount || 0)
      };
      result(null, profile);
    } else {
      result({ kind: "not_found" }, null);
    }
  });
};

OnlineCustomer.getAllForAdmin = (result) => {
  const query = `
    SELECT 
      c.customer_id as customerId,
      CONCAT(c.first_name, ' ', c.last_name) as name,
      c.email,
      c.phone,
      a.account_type,
      c.status as customerStatus,
      a.status as accountStatus,
      /* Get the most recent balance from the ledger */
      COALESCE(a.balance, 0) as currentBalance,
      
      /* Aggregate Transaction Summary */
      (SELECT IFNULL(SUM(amount), 0) FROM transactions 
       WHERE account_id = a.account_id AND transaction_type = 'deposit') as totalDeposits,
       
      (SELECT COUNT(*) FROM transactions 
       WHERE account_id = a.account_id) as totalActivity
       
    FROM customers c
    LEFT JOIN accounts a ON c.customer_id = a.customer_id
    ORDER BY c.created_at DESC`;

  sql.query(query, (err, res) => {
    if (err) {
      console.error("Error fetching admin data:", err);
      result(err, null);
      return;
    }

    // Format results for the Admin Table/UI
    const customersList = res.map(row => ({
      ...row,
      currentBalance: parseFloat(row.currentBalance).toFixed(2),
      totalDeposits: parseFloat(row.totalDeposits).toFixed(2),
      totalActivity: parseInt(row.totalActivity)
    }));

    result(null, customersList);
  });
};

module.exports = OnlineCustomer;
