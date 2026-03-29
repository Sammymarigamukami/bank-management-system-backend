
const userAuth = async (req, res) => {
  console.log("Checking user authentication...");
  console.log("User info from token:", req.user);
  try {

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: req.user.customer_id || req.user.employee_id,
        username: req.user.username|| req.user.user_name,
        email: req.user.email || null,
        role: req.user.role,
        phone: req.user.phone || null
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

module.exports = { userAuth };