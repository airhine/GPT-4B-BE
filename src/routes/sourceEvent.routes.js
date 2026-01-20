import express from "express";
import SourceEvent from "../models/SourceEvent.model.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// @route   GET /api/source-events
// @desc    Get source events for the logged-in user (optional cardIds filter)
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

    const events = await SourceEvent.findByUserId(req.user.id, parsedCardIds);

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;

