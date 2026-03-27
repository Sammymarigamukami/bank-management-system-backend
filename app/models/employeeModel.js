const db = require("./db.js");

class EmployeeModel {

  //  CREATE
 static create(employee, connectionOrCallback, maybeCallback) {
    let connection = db; // default to global db
    let callback;

    // Determine if connection is passed
    if (typeof maybeCallback === "function") {
      connection = connectionOrCallback;
      callback = maybeCallback;
    } else {
      callback = connectionOrCallback;
    }

    if (!employee.employee_id || !employee.email) {
      return callback(new Error("Employee ID and email are required"), null);
    }
    console.log("creating employee with details: ", employee);
    const sql = `
      INSERT INTO employees 
      (employee_id, first_name, last_name, email, phone, national_id, hire_date, branch_id, department_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      employee.employee_id,
      employee.first_name,
      employee.last_name,
      employee.email,
      employee.phone,
      employee.national_id,
      employee.hire_date,
      employee.branch_id,
      employee.department_id || null
    ];

    connection.query(sql, values, (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  //  GET SINGLE
  static findById(employeeId, callback) {
    const sql = "SELECT * FROM employees WHERE employee_id = ?";
    db.query(sql, [employeeId], (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows[0] || null);
    });
  }

  //  GET ALL (WITH PAGINATION + FILTERING)
  static getAll({ page = 1, limit = 10, status, branch_id }, callback) {
    const offset = (page - 1) * limit;

    let sql = "SELECT * FROM employees WHERE 1=1";
    let params = [];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    if (branch_id) {
      sql += " AND branch_id = ?";
      params.push(branch_id);
    }

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    db.query(sql, params, (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows);
    });
  }

  //  COUNT (for pagination)
  static count({ status, branch_id }, callback) {
    let sql = "SELECT COUNT(*) as total FROM employees WHERE 1=1";
    let params = [];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    if (branch_id) {
      sql += " AND branch_id = ?";
      params.push(branch_id);
    }

    db.query(sql, params, (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows[0].total);
    });
  }

  //  UPDATE PROFILE
  static update(employeeId, data, callback) {
    const fields = [];
    const values = [];

    Object.keys(data).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    });

    if (fields.length === 0) {
      return callback(new Error("No fields to update"), null);
    }

    const sql = `
      UPDATE employees 
      SET ${fields.join(", ")} 
      WHERE employee_id = ?
    `;

    values.push(employeeId);

    db.query(sql, values, (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  //  CHANGE STATUS (IMPORTANT)
  static updateStatus(employeeId, status, callback) {
    const allowed = ['active', 'suspended', 'terminated'];

    if (!allowed.includes(status)) {
      return callback(new Error("Invalid status"), null);
    }

    const sql = "UPDATE employees SET status = ? WHERE employee_id = ?";
    db.query(sql, [status, employeeId], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

  //  SEARCH (ADMIN TOOL)
  static search(keyword, callback) {
    const sql = `
      SELECT * FROM employees
      WHERE first_name LIKE ? 
      OR last_name LIKE ? 
      OR email LIKE ?
    `;

    const like = `%${keyword}%`;

    db.query(sql, [like, like, like], (err, rows) => {
      if (err) return callback(err, null);
      callback(null, rows);
    });
  }

  //  DELETE (SOFT DELETE ONLY)
  static softDelete(employeeId, callback) {
    const sql = `
      UPDATE employees 
      SET status = 'terminated' 
      WHERE employee_id = ?
    `;

    db.query(sql, [employeeId], (err, result) => {
      if (err) return callback(err, null);
      callback(null, result);
    });
  }

}

module.exports = EmployeeModel;