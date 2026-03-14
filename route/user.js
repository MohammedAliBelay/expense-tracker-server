const express = require("express");
const router = express.Router();
const userController = require("../controller/usercontroller");
const auth = require("../middleware/auth");

// Routes
router.get("/", auth, userController.getAllUsers); // Admin view
router.get("/profile", auth, userController.getProfile); // Personal view

module.exports = router;
