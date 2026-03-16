const rateLimit = require("express-rate-limit");

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
});

router.post("/forgot-password", resetLimiter, forgotPassword);
router.post("/reset-password/:token", resetLimiter, resetPassword);