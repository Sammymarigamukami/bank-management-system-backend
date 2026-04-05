const Transaction = require("../models/transactionModel.js");

exports.getDashboardAnalytics = async (req, res) => {
  const customerId = req.params.customerId;

  try {
    // We wrap your model's callback-based methods in Promises to run them concurrently
    const [spending, trends, budgets] = await Promise.all([
      new Promise((resolve, reject) => {
        Transaction.getSpendingAnalytics(customerId, (err, data) => (err ? reject(err) : resolve(data)));
      }),
      new Promise((resolve, reject) => {
        Transaction.getMonthlyTrends(customerId, (err, data) => (err ? reject(err) : resolve(data)));
      }),
      new Promise((resolve, reject) => {
        Transaction.getBudgetAnalytics(customerId, (err, data) => (err ? reject(err) : resolve(data)));
      })
    ]);

    // Calculate Summary Stats (Income/Expenses/Savings Rate)
    // Based on the current month's trend data
    const currentMonth = trends[trends.length - 1] || { income: 0, expenses: 0 };
    const income = parseFloat(currentMonth.income);
    const expenses = parseFloat(currentMonth.expenses);
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    // Send unified response
    res.status(200).json({
      success: true,
      summary: {
        totalIncome: income,
        totalExpenses: expenses,
        savingsRate: savingsRate.toFixed(1),
        netWorth: income - expenses // Simplification based on current month
      },
      spendingByCategory: spending, // For the Progress bars
      monthlyOverview: trends,       // For the Bar charts
      budgetGoals: budgets.map(b => ({
        category: b.category,
        budget: 10000, // Example hardcoded budget - usually comes from a 'budgets' table
        spent: parseFloat(b.spent),
        currentBalance: parseFloat(b.current_balance)
      }))
    });

  } catch (error) {
    console.error("Analytics Controller Error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving analytics data",
      error: error.message
    });
  }
};