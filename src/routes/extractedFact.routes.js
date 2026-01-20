import express from "express";
import ExtractedFact from "../models/ExtractedFact.model.js";
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

    const facts = await ExtractedFact.findByUserId(req.user.id, parsedCardIds);

    res.json({
      success: true,
      data: facts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;

