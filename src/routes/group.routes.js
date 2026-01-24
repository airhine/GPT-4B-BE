import express from "express";
import { body } from "express-validator";
import { validationResult } from "express-validator";
import { authenticate } from "../middleware/auth.middleware.js";
import CardGroup from "../models/CardGroup.model.js";

const router = express.Router();

// 모든 라우트는 인증 필요
router.use(authenticate);

// 그룹 목록 조회
router.get("/", async (req, res) => {
  try {
    const groups = await CardGroup.findByUserId(req.user.id);
    console.log(`[그룹 조회] 사용자 ID: ${req.user.id}, 조회된 그룹 개수: ${groups.length}`);
    // 각 그룹에 cardIds 포함
    const groupsWithCards = await Promise.all(
      groups.map(async (group) => {
        const fullGroup = await CardGroup.findById(group.id, req.user.id);
        return fullGroup;
      })
    );
    console.log(`[그룹 조회] 최종 그룹 개수: ${groupsWithCards.length}`);
    res.json({ success: true, data: groupsWithCards });
  } catch (error) {
    console.error('[그룹 조회 에러]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 그룹 순서 업데이트 (/:id 라우트보다 먼저 정의해야 함)
router.put("/orders", [body("groupOrders").isArray()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { groupOrders } = req.body;
    console.log(`[그룹 순서 업데이트] 사용자 ID: ${req.user.id}, 업데이트할 그룹 개수: ${groupOrders.length}`);
    console.log('[그룹 순서 업데이트] 순서 데이터:', groupOrders);
    
    await CardGroup.updateOrders(req.user.id, groupOrders);
    
    // 업데이트된 그룹 목록 반환 (요청한 순서대로 정렬)
    const groups = await CardGroup.findByUserId(req.user.id);
    
    // 요청한 순서대로 그룹 정렬
    const groupOrderMap = new Map(groupOrders.map((order, index) => [order.groupId, index]));
    const sortedGroups = groups.sort((a, b) => {
      const orderA = groupOrderMap.get(a.id) ?? 999;
      const orderB = groupOrderMap.get(b.id) ?? 999;
      return orderA - orderB;
    });
    
    const groupsWithCards = await Promise.all(
      sortedGroups.map(async (group) => {
        const fullGroup = await CardGroup.findById(group.id, req.user.id);
        return fullGroup;
      })
    );
    
    console.log(`[그룹 순서 업데이트] 완료, 최종 그룹 개수: ${groupsWithCards.length}`);
    console.log(`[그룹 순서 업데이트] 그룹 순서:`, groupsWithCards.map(g => ({ id: g.id, name: g.name, displayOrder: g.displayOrder })));
    res.json({ success: true, data: groupsWithCards });
  } catch (error) {
    console.error('[그룹 순서 업데이트 에러]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 그룹 상세 조회
router.get("/:id", async (req, res) => {
  try {
    const group = await CardGroup.findById(req.params.id, req.user.id);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    res.json({ success: true, data: group });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 그룹 생성
router.post(
  "/",
  [body("name").notEmpty().trim(), body("cardIds").optional().isArray()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { name, cardIds = [] } = req.body;
      const group = await CardGroup.create(req.user.id, name, cardIds);
      res.status(201).json({ success: true, data: group });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// 그룹 수정
router.put(
  "/:id",
  [body("name").optional().notEmpty().trim(), body("cardIds").optional().isArray()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { name, cardIds } = req.body;
      const group = await CardGroup.update(req.params.id, req.user.id, name, cardIds);
      if (!group) {
        return res.status(404).json({ success: false, message: "Group not found" });
      }
      res.json({ success: true, data: group });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// 그룹 삭제
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await CardGroup.delete(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    res.json({ success: true, message: "Group deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 그룹에 명함 추가
router.post("/:id/cards", [body("cardId").isInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    await CardGroup.addCard(req.params.id, req.body.cardId);
    const group = await CardGroup.findById(req.params.id, req.user.id);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    res.json({ success: true, data: group });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 그룹에서 명함 제거
router.delete("/:id/cards/:cardId", async (req, res) => {
  try {
    await CardGroup.removeCard(req.params.id, req.params.cardId);
    const group = await CardGroup.findById(req.params.id, req.user.id);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }
    res.json({ success: true, data: group });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
