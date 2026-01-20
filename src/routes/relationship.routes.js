import express from "express";
import Relationship from "../models/Relationship.model.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @route   GET /api/relationship/graph
 * @desc    관계 그래프 데이터 조회
 * @access  Private
 */
router.get("/graph", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const graphData = await Relationship.getGraphData(userId);
    
    res.json({
      success: true,
      data: graphData
    });
  } catch (error) {
    console.error("그래프 데이터 조회 오류:", error);
    res.status(500).json({
      success: false,
      message: error.message || "그래프 데이터를 불러오는데 실패했습니다."
    });
  }
});

/**
 * @route   GET /api/relationship/:contactId/summary
 * @desc    관계 요약 정보 조회 (기본 정보만, LLM 없이)
 * @access  Private
 */
router.get("/:contactId/summary", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = parseInt(req.params.contactId);
    
    if (isNaN(contactId)) {
      return res.status(400).json({
        success: false,
        message: "올바른 명함 ID가 아닙니다."
      });
    }
    
    const summary = await Relationship.getRelationshipSummary(userId, contactId);
    
    if (!summary) {
      return res.status(404).json({
        success: false,
        message: "명함을 찾을 수 없습니다."
      });
    }
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error("관계 요약 조회 오류:", error);
    res.status(500).json({
      success: false,
      message: error.message || "관계 요약 정보를 불러오는데 실패했습니다."
    });
  }
});

/**
 * @route   GET /api/relationship/:contactId/summary/llm
 * @desc    LLM 자연어 요약 생성
 * @access  Private
 */
router.get("/:contactId/summary/llm", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = parseInt(req.params.contactId);
    
    if (isNaN(contactId)) {
      return res.status(400).json({
        success: false,
        message: "올바른 명함 ID가 아닙니다."
      });
    }
    
    // 기본 정보 먼저 가져오기
    const baseSummary = await Relationship.getRelationshipSummary(userId, contactId);
    
    if (!baseSummary) {
      return res.status(404).json({
        success: false,
        message: "명함을 찾을 수 없습니다."
      });
    }
    
    // LLM 요약 생성
    const llmSummaries = await Relationship.generateLLMSummaries(
      userId,
      contactId,
      baseSummary.factTypeStats,
      baseSummary.contactName
    );
    
    res.json({
      success: true,
      data: llmSummaries
    });
  } catch (error) {
    console.error("LLM 요약 생성 오류:", error);
    res.status(500).json({
      success: false,
      message: error.message || "LLM 요약을 생성하는데 실패했습니다."
    });
  }
});

export default router;
