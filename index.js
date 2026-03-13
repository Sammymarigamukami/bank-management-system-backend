const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();


const app = express();
const PORT = 8000;

app.use(express.json());
app.use(
  cors({
    origin: ['http://127.0.0.1:3000', 'http://localhost:5173' , 'http://localhost:3000'],
  })
);
console.log('env secret: ', process.env.JWT_SECRET);
require('./app/routes/customer.routes')(app);
require('./app/routes/fd.routes')(app);
require('./app/routes/account.routes')(app);
require('./app/routes/physicalloan.routes')(app);
require('./app/routes/onlineloan.routes')(app);
require('./app/routes/transaction.routes')(app);
require('./app/routes/auth.routes')(app);
require('./app/routes/withdrawal.routes')(app);
require('./app/routes/deposit.routes')(app);
require('./app/routes/onlineCustomer.routes')(app);
require('./app/routes/employee.routes')(app);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
