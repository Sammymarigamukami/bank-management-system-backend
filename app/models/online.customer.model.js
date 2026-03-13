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

    if (!newOnlineCustomer.Username || !newOnlineCustomer.Email ||!newOnlineCustomer.Password) {
      return result({ kind: 'validation_error', message: 'Missing required fields' }, null);
    }
    const username = newOnlineCustomer.Username.trim().toLowerCase();
    const email = newOnlineCustomer.Email.trim().toLowerCase();
    const password = newOnlineCustomer.Password;

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
      Username: username,
      Email: email,
      Password: hashedPassword,
    };

    sql.query("INSERT INTO OnlineCustomer SET ?", data, (err, res) => {
      if (err) {
        console.log('error: ', err);
        if (err.code === "ER_DUP_ENTRY") {
        return result({ kind: 'username_or_email_exists', message: 'Username or email already exists' }, null);
        }

        if (err.code === "ER_NO_REFERENCED_ROW_2") {
          return result({ kind: 'username_does_not_exist', message: 'Customer does not exist' }, null);
        }

       return result({ message: "Database error"} , null);
      }
      const responseData = {
        customerID: res.insertId,
        Username: username,
        Email: email,
      };
      console.log('created online customer: ', responseData);
      result(null, responseData);
    })

  } catch (error) {
    result({ kind: 'error', message: 'Error creating online customer' }, null);
  }
};

OnlineCustomer.findByUsername = (username, result) => {
  console.log('in findUser');
  const query = `SELECT * FROM OnlineCustomer WHERE Username = ?`;

  sql.query(query, username, (err, res) => {
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

OnlineCustomer.delete = (id, result) => {
  const query = `DELETE FROM OnlineCustomer WHERE CustomerID = ?`;
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
