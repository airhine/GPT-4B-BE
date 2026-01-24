import express from "express";
import pool from "../config/database.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// @route   GET /api/extracted-facts
// @desc    Get extracted facts for the logged-in user (optional cardIds filter)
// @access  Private
router.get("/", async (req, res) => {
  try {
    const { cardIds } = req.query;
    const parsedCardIds = cardIds
      ? String(cardIds)
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : [];

    let query = "SELECT * FROM HCI_2025.extracted_fact WHERE user_id = ?";
    const params = [req.user.id];

    if (parsedCardIds.length > 0) {
      const placeholders = parsedCardIds.map(() => "?").join(", ");
      query += ` AND card_id IN (${placeholders})`;
      params.push(...parsedCardIds);
    }

    query += " ORDER BY id DESC";

    const [rows] = await pool.query(query, params);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
