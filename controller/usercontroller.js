const db = require("../config/db");

// Get all users (Only for Owner)
exports.getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== "owner") {
      return res.status(403).json({ message: "Access denied" });
    }
    const [users] = await db.query("SELECT id, name, email, role FROM users");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const [user] = await db.query(
      "SELECT id, name, email, role FROM users WHERE id = ?",
      [req.user.id],
    );
    if (user.length === 0)
      return res.status(404).json({ message: "User not found" });
    res.json(user[0]);
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
};
