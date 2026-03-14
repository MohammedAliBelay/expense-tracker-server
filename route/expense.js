const express = require("express");
const router = express.Router();
const expenseController = require("../controller/expenscontroller");
const auth = require("../middleware/auth");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

router.get("/", auth, expenseController.getAllExpenses);
router.post("/", auth, upload.single("receipt"), expenseController.addExpense);
router.put("/:id", auth, expenseController.updateExpense);
router.delete("/:id", auth, expenseController.deleteExpense);
router.put("/approve/:id", auth, expenseController.approveExpense);
router.get("/export/excel", auth, expenseController.exportExcel);

module.exports = router;
