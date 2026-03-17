
const userAuth = async (req, res) => {
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
        id: req.user.customer_id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role
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