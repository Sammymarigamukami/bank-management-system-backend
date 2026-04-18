const OnlineCustomer = require("../models/online.customer.model.js");
const Transaction = require("../models/transactionModel.js");
const FinancialStats = require("../models/financialStatsModel.js");
const Audit = require("../models/auditLogModel.js");


exports.getCustomerFullProfile = (req, res) => {
  const customerId = req.params.customerId;
  

  const filters = {
    type: req.query.type || 'all',
    status: req.query.status || 'all',
    fromDate: req.query.fromDate || null,
    toDate: req.query.toDate || null,
    minAmount: req.query.minAmount || null,
    maxAmount: req.query.maxAmount || null
  };

  OnlineCustomer.getFullProfile(customerId, (err, profileData) => {
    console.log("Profile Data:", profileData);
    if (err) return res.status(500).json({ success: false, message: "Profile Error" });

    // Use the filtered history method instead of the generic one
    Transaction.getFilteredHistoryByAccount(profileData.account_id, filters, (err, history) => {
      if (err) return res.status(500).json({ success: false, message: "History Error" });

      res.status(200).json({
        success: true,
        data: {
          profile: profileData,
          transactions: history
        }
      });
    });
  });
};

exports.findAll = (req, res) => {
  OnlineCustomer.getAllForAdmin((err, data) => {
    if (err) {
      // 500 Internal Server Error for DB issues
      res.status(500).send({
        success: false,
        message: err.message || "Some error occurred while retrieving customer data."
      });
    } else {
      // If no data is found, send a 204 (No Content) or an empty array
      if (data.length === 0) {
        res.status(200).send({
          success: true,
          message: "No customers found in the system.",
          count: 0,
          data: []
        });
      } else {
        // Return the formatted list
        res.status(200).send({
          success: true,
          count: data.length,
          data: data
        });
      }
    }
  });
};

exports.getAccountReport = (req, res) => {
  FinancialStats.getActiveAccountsReport((err, data) => {
    if (err) {
      res.status(500).send({
        success: false,
        message: "Error retrieving active accounts report."
      });
    } else {
      res.status(200).send({
        success: true,
        count: data.length,
        data: data
      });
    }
  });
};

/**
 * Helper function to handle audit logging to keep controllers clean
 */
const createAuditTrail = (req, action, entityId) => {
  console.log(`Creating audit log for action: ${action} on entity ID: ${entityId} by employee ID: ${req.user?.employee_id}`);
  if (!req.user.employee_id) {
    console.warn("No authenticated user found for audit logging.");
    return;
  }
  const auditEntry = {
    employee_id: req.user?.employee_id,
    action: action,
    entity: "online_customers",
    entity_id: entityId,
    ip_address: req.ip || req.connection.remoteAddress
  };

  Audit.log(auditEntry, (err) => {
    if (err) {
      console.error(`Failed to log audit for ${action} on customer ${entityId}`);
    }
  });
};

// Activate a customer account
exports.activate = (req, res) => {
  const customerId = req.params.customerId;

  OnlineCustomer.activate(customerId, (err, data) => {
    if (err) {
      if (err.kind === "not_found_or_closed") {
        return res.status(404).send({
          message: `Cannot activate. Customer with id ${customerId} was not found or is permanently closed.`
        });
      }
      return res.status(500).send({
        message: err.message || "Error activating customer with id " + customerId
      });
    }

    // Log the successful activation
    createAuditTrail(req, "ACTIVATE_ACCOUNT", customerId);
    
    res.status(200).send(data);
  });
};

// Suspend a customer account
exports.deactivate = (req, res) => {
  const customerId = req.params.customerId;
  OnlineCustomer.deactivate(customerId, (err, data) => {
    if (err) {
      if (err.kind === "not_found_or_closed") {
        return res.status(404).send({
          message: `Cannot deactivate. Customer with id ${customerId} was not found or is permanently closed.`
        });
      }
      return res.status(500).send({
        message: err.message || "Error deactivating customer with id " + customerId
      });
    }

    // Log the successful deactivation
    createAuditTrail(req, "DEACTIVATE_ACCOUNT", customerId);

    res.status(200).send(data);
  });
};

// Permanently close a customer account
exports.closeAccount = (req, res) => {
  const customerId = req.params.customerId;

  OnlineCustomer.closeAccount(customerId, (err, data) => {
    if (err) {
      if (err.kind === "not_found") {
        return res.status(404).send({
          message: `Not found Customer with id ${customerId}.`
        });
      }
      return res.status(500).send({
        message: err.message || "Could not close account for Customer with id " + customerId
      });
    }

    // Log the successful closure
    createAuditTrail(req, "CLOSE_ACCOUNT_PERMANENT", customerId);

    res.status(200).send(data);
  });
};