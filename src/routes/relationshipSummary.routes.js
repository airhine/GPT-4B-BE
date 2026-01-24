import express from "express";
import pool from "../config/database.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// @route   GET /api/relationship-summary
// @desc    Get relationship summary for a specific card
// @access  Private
router.get("/", async (req, res) => {
  try {
    const { cardId } = req.query;
    
    if (!cardId) {
      return res.status(400).json({
        success: false,
        message: "cardId is required",
      });
    }

    // Get extracted facts for this card
    const [facts] = await pool.query(
      "SELECT * FROM HCI_2025.extracted_fact WHERE user_id = ? AND card_id = ? ORDER BY id DESC",
      [req.user.id, cardId]
    );

    // Build a simple summary from facts
    const summary = {
      cardId,
      factCount: facts.length,
      facts: facts.slice(0, 10), // Return up to 10 facts
      snapshot: {
        relationshipDensity: Math.min(10, 2 + facts.length * 0.5),
        businessRelevance: Math.min(10, 3 + facts.length * 0.3),
        personalAffinity: Math.min(10, 2 + facts.length * 0.4),
      },
      narrative: facts.length > 0 
        ? `이 명함과 관련된 ${facts.length}개의 정보가 있습니다.`
        : "아직 관계 정보가 없습니다.",
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
