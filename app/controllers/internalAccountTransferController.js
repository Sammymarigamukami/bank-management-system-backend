
const AccountTransferModel = require("../models/userAccountTransferModel.js")

exports.transfer = (req, res) => {

    const customerId = req.user?.customer_id; 
    console.log("Initiating transfer for customer:", req.user);
    const { fromAccountId, toAccountId, amount } = req.body;

    if(!customerId) return res.status(401).json({ success: false, message: "Unauthorized" });

    AccountTransferModel.transferBetweenOwnAccounts(
      customerId,
      fromAccountId,
      toAccountId,
      amount,
      (err, result) => {
        if (err) {
          return res.status(400).json({ 
            success: false,
            message: err.message 
          });
        }
        res.status(200).json(result);
      }
    );
};