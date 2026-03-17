
const AccountTransferModel = require("../models/userAccountTransferModel.js")
exports.transfer = (req, res) => {

  const { fromAccountId, toAccountId, amount } = req.body;

  AccountTransferModel.transferBetweenAccounts(
    fromAccountId,
    toAccountId,
    amount,
    (err, result) => {

      if (err) {
        return res.status(400).json({ error: err.message });
      }

      res.json(result);
    }
  );

};