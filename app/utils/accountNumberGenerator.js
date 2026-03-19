const crypto = require('crypto');

function generateAccountNumber() {
  const year = new Date().getFullYear().toString().slice(-2); // 26
  const randomPart = crypto.randomInt(10000000, 99999999); // 8-digit random number

  return year + randomPart; 
}

module.exports = generateAccountNumber;