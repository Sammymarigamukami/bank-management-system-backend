const onlineCustomers = require('../models/online.customer.model.js');
const EmployeeModel = require('../models/employeeModel.js');
const EmployeeAuthModel = require('../models/authEmployeeModel.js');
const RoleModel = require('../models/roleModel.js');
const EmployeeRoleModel = require('../models/employeeRoleModel.js');
const bcrypt = require('bcrypt');
const db = require('../models/db.js');
const jwt = require('jsonwebtoken');
const CustomerRoleModel = require('../models/customerRoleModel.js');
const Audit = require('../models/auditLogModel.js');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

exports.customerLogin = (req, res) => {
  const bcrypt = require('bcrypt');

  const userName = req.body.loginDetails?.userName;
  const password = req.body.loginDetails?.password;

  if (!userName || !password) {
    return res.status(400).json({
      auth: 'fail',
      message: 'Username and password required',
    });
  }

  //  Find customer
  onlineCustomers.findByUsername(userName, (err, data) => {
    console.log("CustomerAuthModel.findByUsername result: ", data);
    console.log("CustomerAuthModel.findByUsername error: ", err);
    if (!data) {
      return res.status(404).json({
        auth: 'fail',
        message: 'User not found',
      });
    }

    const hash = data.password_hash;

    // 2 Compare password
    bcrypt.compare(password, hash, (err, match) => {
      if (err) {
        return res.status(500).json({
          auth: 'fail',
          message: 'Error comparing password',
        });
      }

      if (!match) {
        return res.status(401).json({
          auth: 'fail',
          message: 'Incorrect password',
        });
      }
      console.log("Password match successful for user: ", userName);

      const customerId = data.customer_id;

      // 3 Get roles from DB
      CustomerRoleModel.getRoles(customerId, (err, roles) => {
        console.log("CustomerRoleModel.getRoles result: ", roles);
        if (err) {
          return res.status(500).json({
            auth: 'fail',
            message: 'Failed to load roles',
          });
        }

        const roleNames = roles.map(r => r.role_name);

        // 4 Build token payload (SAFE)
        const payload = {
          customerId,
          username: userName,
          roles: roleNames
        };

        const token = jwt.sign(payload, JWT_SECRET, {
          expiresIn: '8h'
        });

        // 5️⃣ Response
        return res.json({
          auth: 'success',
          token,
          customerId,
          expires: '8h',
          userName,
          email: data.email,
          roles: roleNames,
        });
      });
    });
  });
};


exports.employeeLogin = (req, res) => {
  console.log("Login attempt");

  const userName = req.body.loginDetails?.userName;
  const password = req.body.loginDetails?.password;

  if (!userName || !password) {
    return res.status(400).json({
      auth: "fail",
      message: "Username and password required",
    });
  }

  const bcrypt = require("bcrypt");

  // Get auth record
  EmployeeAuthModel.findByUsername(userName, (err, authData) => {
    if (err) {
      return res.status(500).json({
        auth: "fail",
        message: "Error retrieving user",
      });
    }

    if (!authData) {
      return res.status(404).json({
        auth: "fail",
        message: "User not found",
      });
    }

    // Compare password
    bcrypt.compare(password, authData.password_hash, (err, match) => {
      if (err) {
        return res.status(500).json({
          auth: "fail",
          message: "Password comparison failed",
        });
      }

      if (!match) {
        // OPTIONAL: Log failed attempt for security
        Audit.log({
          employee_id: authData.employee_id,
          action: 'LOGIN_FAILED',
          entity: 'AUTH',
          entity_id: authData.employee_id,
          ip_address: req.ip || req.connection.remoteAddress
        }, () => {});

        return res.status(401).json({
          auth: "fail",
          message: "Incorrect password",
        });
      }

      const employeeId = authData.employee_id;

      // Load employee profile
      EmployeeModel.findById(employeeId, (err, employee) => {
        if (err || !employee) {
          return res.status(500).json({
            auth: "fail",
            message: "Failed to load employee profile",
          });
        }

        // Load roles
        EmployeeRoleModel.getRoles(employeeId, (err, roles) => {
          if (err) {
            return res.status(500).json({
              auth: "fail",
              message: "Failed to load employee roles",
            });
          }

          const roleNames = roles.map(r => r.role_name);

          // Build JWT payload
          const payload = {
            employeeId: employee.employee_id,
            username: userName,
            branchId: employee.branch_id,
            roles: roleNames
          };

          const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });

          // --- WIRE IN THE AUDIT LOG HERE ---
          const auditEntry = {
            employee_id: employee.employee_id,
            action: 'LOGIN_SUCCESS',
            entity: 'EMPLOYEES',
            entity_id: employee.employee_id,
            ip_address: req.ip || req.headers['x-forwarded-for'] || '0.0.0.0'
          };

          Audit.log(auditEntry, (auditErr) => {
            if (auditErr) console.error("Audit log failed to save:", auditErr);

            // Send Response only after trying to log
            res.json({
              auth: "success",
              username: userName,
              token,
              employeeId: employee.employee_id,
              branchId: employee.branch_id,
              roles: roleNames,
            });

            console.log("Login successful & logged for:", employee.employee_id);
          });
        });
      });
    });
  });
};


exports.createEmployee = (req, res) => {
  const {
    first_name,
    last_name,
    user_name,
    email,
    phone,
    national_id,
    date_of_birth,
    hire_date,
    branch_id,
    department_id,
    password,
  } = req.body;

  // 1. Validation
  if (!req.body || !password || !user_name || !first_name || !last_name || !email) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  // Generate public employee ID
  const employeeId = Math.random().toString(36).substring(2, 10).toUpperCase();
  const creatorId = req.employeeId; // Retrieved from your Auth Middleware (the admin)

  const employee = {
    employee_id: employeeId,
    first_name,
    last_name,
    email,
    phone,
    national_id,
    date_of_birth,
    hire_date,
    branch_id,
    department_id,
  };

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).json({ success: false, message: "Password hashing failed" });

    db.getConnection((err, connection) => {
      if (err) return res.status(500).json({ success: false, message: "DB connection failed" });

      connection.beginTransaction((err) => {
        if (err) { connection.release(); return res.status(500).json({ success: false, message: "Transaction failed" }); }

        // Create employee
        EmployeeModel.create(employee, connection, (err, empResult) => {
          if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ success: false, error: err.message }); });

          // Create auth record
          EmployeeAuthModel.create(
            { employee_id: employeeId, username: user_name, password_hash: hashedPassword },
            connection,
            (err, authResult) => {
              if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ success: false, error: err.message }); });

              // Fetch default 'employee' role
              RoleModel.findByName('employee', (err, roleData) => {
                if (err || !roleData) return connection.rollback(() => { connection.release(); res.status(500).json({ success: false, message: "Role not found" }); });

                // Assign role
                EmployeeRoleModel.assignRole(employeeId, roleData.role_id, null, connection, (err, roleResult) => {
                  if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ success: false, error: err.message }); });

                  // --- COMMIT TRANSACTION ---
                  connection.commit((err) => {
                    if (err) {
                      return connection.rollback(() => {
                        connection.release();
                        res.status(500).json({ success: false, message: "Commit failed" });
                      });
                    }

                    // --- WIRE IN AUDIT LOG HERE ---
                    const auditEntry = {
                      employee_id: creatorId || 'SYSTEM', // The admin who created the user
                      action: 'CREATE_EMPLOYEE',
                      entity: 'EMPLOYEES',
                      entity_id: employeeId, // The ID of the new employee
                      ip_address: req.ip || req.headers['x-forwarded-for'] || '0.0.0.0'
                    };

                    Audit.log(auditEntry, (auditErr) => {
                      if (auditErr) console.error("Audit log failed:", auditErr);

                      console.log("Transaction committed and audit logged.");
                      connection.release();

                      res.status(201).json({
                        success: true,
                        message: "Employee + Auth + Role created successfully",
                        employee_id: employeeId,
                      });
                    });
                  });
                });
              });
            }
          );
        });
      });
    });
  });
};

exports.createOnlineCustomer = (req, res) => {

  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: 'Online customer details are required',
    })
  }


  console.log('creating online customer with details: ', req.body);
  const onlineCustomer = req.body;
  console.log("online customer details: ", onlineCustomer);

  onlineCustomers.create(onlineCustomer, (err, data) => {
    console.log("OnlineCustomer.create result: ", data);
    console.log("OnlineCustomer.create error: ", err);
    if (err) {
      if (err.kind === 'duplicate') {
        return res.status(409).json({ message: err.message });
      }

      if (
        err.message === "Invalid username format" ||
        err.message === "Invalid email format" ||
        err.message.includes("Password must")
      ) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: 'Internal server error'});
    } else {
      const customerId = data.customerID;
      const userName = data.username;
      const email = data.email;
      const phone = data.phone;
      const firstName = data.firstName;
      const lastName = data.lastName;
      const roles = data.roles;

      const payload = {
        customerId,
        username: userName,
        roles,
      }
      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: '8h'
      });

      res.send({
        auth: 'success',
        roles,
        expires: '8h',
        email,
        customerId,
        userName,
        phone,
        firstName,
        lastName,
        token,
      })
    }
  });
};
