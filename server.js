require("dotenv").config(); // Loads environment variables from .env
const express = require("express");
const cors = require("cors");
const authRoutes = require("./route/auth");
const expenseRoutes = require("./route/expense");
const userRoutes = require("./route/user");

const app = express();

// 1. Middleware
// Allow your React frontend (localhost:3000) to communicate with your backend
(app.use(cors()), // Enable CORS for all origins (you can restrict this in production);
  app.use(express.json())); // Parses incoming JSON requests

// 2. Static Files (for receipts/uploads)
app.use("/uploads", express.static("uploads"));

// 3. API Routes
app.use("/auth", authRoutes);
app.use("/expenses", expenseRoutes);
app.use("/users", userRoutes);

// 4. Basic Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// 5. Server Start
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
