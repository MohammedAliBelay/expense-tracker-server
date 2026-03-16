const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
// import { generateResetToken } from "../utils/generattokin";
const { generateResetToken } = require("../utils/generattokin");
const sendEmail = require("../utils/sendemail");

// ---------------- REGISTER ----------------
exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    // Check if user already exists
    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "User already exists" }); // 409 Conflict
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, role || "user"],
    );
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
};

// ---------------- LOGIN ----------------
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (!rows.length) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Login failed",
    });
  }
};
// ---------------- FORGOT PASSWORD ----------------
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const [user] = await db.query("SELECT * FROM users WHERE email=?", [email]);

  if (!user.length) {
    return res.status(200).json({
      message: "If the email exists, a reset link has been sent.",
    });
  }

  const { resetToken, hashedToken, expires } = generateResetToken();

  await db.query(
    "UPDATE users SET password_reset_token=?, password_reset_expires=? WHERE email=?",
    [hashedToken, new Date(expires), email],
  );

  const resetURL = `http://localhost:5173/reset-password/${resetToken}`;

  await sendEmail({
    to: email,
    subject: "Password Reset Request",
    html: `
      <h3>Password Reset</h3>
      <p>You requested a password reset.</p>
      <p>
        Click the link below to reset your password:
      </p>
      <a href="${resetURL}">${resetURL}</a>
      
      <p>This link expires in 10 minutes.</p>
    `,
  });

  res.json({ message: "Reset link sent to your email" });
};
// ---------------- RESET PASSWORD ----------------
exports.resetPassword = async (req, res) => {
  const crypto = require("crypto");
  const bcrypt = require("bcrypt");

  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const [user] = await db.query(
    `SELECT * FROM users WHERE password_reset_token=? AND password_reset_expires > NOW()`,
    [hashedToken],
  );

  if (!user.length) {
    return res.status(400).json({
      message: "Token invalid or expired",
    });
  }

  const newPassword = await bcrypt.hash(req.body.password, 12);

  await db.query(
    `UPDATE users 
      SET password=?, password_reset_token=NULL,password_reset_expires=NULL WHERE id=?`,
    [newPassword, user[0].id],
  );

  res.json({ message: "Password successfully reset" });
};
