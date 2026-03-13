const mysql = require('mysql2');
const dbConfig = require('../config/db.config.js');

const connection = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
});

module.exports = connection;
