const db = require("../config/db");
const ExcelJS = require("exceljs");
const sendEmail = require("../utils/sendemail");
/* GET all expenses */
exports.getAllExpenses = async (req, res) => {
  try {
    const baseSql =
      "SELECT expenses.*, users.name AS user_name FROM expenses JOIN users ON expenses.user_id = users.id";
    const sql =
      req.user.role === "owner"
        ? baseSql
        : `${baseSql} WHERE expenses.user_id = ? ORDER BY expenses.id DESC`;
    const params = req.user.role === "owner" ? [] : [req.user.id];

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("getAllExpenses error:", err);
    res.status(500).json({ message: "Database error" });
  }
};

/* ADD expense */
exports.addExpense = async (req, res) => {
  try {
    const {
      date,
      amount,
      payer = null,
      source_of_money = "",
      phone,
      reason,
      remark,
    } = req.body || {};

    const receipt = req.file ? req.file.filename : null;

    const formattedDate = date ? date.split("T")[0] : null;
    const status = req.user.role === "owner" ? "Approved" : "Pending";
    await db.query(
      `INSERT INTO expenses (user_id, date, amount, payer, source_of_money, phone, reason, receipt, remark, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        req.user.id,
        formattedDate,
        amount,
        payer,
        source_of_money,
        phone,
        reason,
        receipt,
        remark,
        status,
      ],
    );

    res.json({
      message:
        status === "Approved"
          ? "Expense added and approved"
          : "Expense submitted for approval",
    });
  } catch (err) {
    console.error("addExpense error:", err);
    res.status(500).json({ message: "Failed to save to database" });
  }
};

/* UPDATE expense (row owners only, cannot edit Approved rows; owners must use approveExpense) */
exports.updateExpense = async (req, res) => {
  const { id } = req.params;
  const {
    date,
    amount,
    payer = null,
    source_of_money = "",
    phone,
    reason,
    receipt,
    remark,
    // status is intentionally ignored here for non-owner updates
  } = req.body;

  const formattedDate = date ? date.split("T")[0] : null;

  try {
    const [rows] = await db.query("SELECT * FROM expenses WHERE id = ?", [id]);
    if (!rows.length)
      return res.status(404).json({ message: "Expense not found" });

    const expense = rows[0];

    // Prevent edits to Approved rows
    if (expense.status === "Approved") {
      return res
        .status(403)
        .json({ message: "Approved items cannot be edited" });
    }

    // Owners are restricted from using this endpoint to change records;
    // owners should use approveExpense to change status only.
    if (req.user.role === "owner") {
      return res.status(403).json({
        message: "Owners should use the approve endpoint for status changes",
      });
    }

    // Only row owner may update
    if (expense.user_id !== req.user.id) {
      return res.status(403).json({ message: "Permission denied" });
    }

    await db.query(
      `UPDATE expenses SET date = ?, amount = ?, payer = ?, source_of_money = ?, phone = ?, reason = ?, receipt = ?, remark = ? WHERE id = ?`,
      [
        formattedDate,
        amount,
        payer,
        source_of_money,
        phone,
        reason,
        receipt,
        remark,
        id,
      ],
    );

    res.json({ message: "Updated successfully" });
  } catch (err) {
    console.error("updateExpense error:", err);
    res.status(500).json({ message: "Database error during update" });
  }
};

/* DELETE expense (row owners only, cannot delete Approved rows) */
exports.deleteExpense = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT user_id, status FROM expenses WHERE id = ?",
      [req.params.id],
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Not found" });

    const expense = rows[0];

    // Prevent deleting approved rows
    if (expense.status === "Approved") {
      return res
        .status(403)
        .json({ message: "Approved items cannot be deleted" });
    }

    if (req.user.role !== "owner" && expense.user_id !== req.user.id) {
      return res.status(403).json({ message: "Permission denied" });
    }

    // If owner role should NOT delete other users' rows, adjust above check.
    await db.query("DELETE FROM expenses WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("deleteExpense error:", err);
    res.status(500).json({ message: "Database error" });
  }
};

/* Approve/Reject expense (owners only) */
exports.approveExpense = async (req, res) => {
  try {
    // Only owners can approve/reject
    if (req.user.role !== "owner")
      return res.status(403).json({ message: "Owners only" });

    const { status } = req.body;
    const allowed = ["Pending", "Approved", "Rejected"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Update the expense
    const [result] = await db.query(
      "UPDATE expenses SET status = ? WHERE id = ?",
      [status, req.params.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    // If rejected, fetch user email and send notification
    if (status === "Rejected") {
      const [expenseData] = await db.query(
        "SELECT e.amount, u.email, u.name FROM expenses e JOIN users u ON e.user_id = u.id WHERE e.id = ?",
        [req.params.id],
      );

      if (expenseData.length) {
        const expense = expenseData[0];
        await sendEmail({
          to: expense.email,
          subject: "Expense Request Rejected",
          html: `
            <p>Hi ${expense.name},</p>
            <p>Your expense request "<strong>${expense.amount}</strong>" has been <strong>rejected</strong>.</p>
            <p>If you have any questions, please contact the management.</p>
            <p>Thank you.</p>
          `,
        });
      }
    }
    res.json({ message: "Updated" });
  } catch (err) {
    console.error("approveExpense error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
/* Export Excel (includes payer and source_of_money) */
exports.exportExcel = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT expenses.*, users.name as user_name FROM expenses JOIN users ON expenses.user_id = users.id WHERE expenses.status = 'Approved' ORDER BY expenses.id DESC`,
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Expenses");

    worksheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "employee-name", key: "user_name", width: 20 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "Payer", key: "payer", width: 20 },
      { header: "Source", key: "source_of_money", width: 15 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Reason", key: "reason", width: 30 },
      { header: "Status", key: "status", width: 12 },
    ];

    // Normalize rows for Excel (ensure keys exist)
    const normalized = rows.map((r) => ({
      date: r.date ? String(r.date).split("T")[0] : "",
      user_name: r.user_name || "",
      amount: r.amount || "",
      payer: r.payer || "",
      source_of_money: r.source_of_money || "",
      phone: r.phone || "",
      reason: r.reason || "",
      status: r.status || "",
    }));

    worksheet.addRows(normalized);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", "attachment; filename=expenses.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("exportExcel error:", err);
    res.status(500).send("Excel export failed");
  }
};
