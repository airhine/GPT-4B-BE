import express from "express";
import { body, validationResult } from "express-validator";
import User from "../models/User.model.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get("/profile", async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put(
  "/profile",
  [
    body("name").optional().trim(),
    body("phone").optional().trim(),
    body("email").optional().isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      // 디버깅: 받은 데이터 로그
      console.log("==========================================");
      console.log("👤 [프로필 수정] PUT /api/users/profile");
      console.log("==========================================");
      console.log(`사용자 ID: ${req.user.id}`);
      console.log(`받은 데이터:`, JSON.stringify(req.body, null, 2));
      if (req.body.cardDesign) {
        console.log(`✅ cardDesign 값 수신: "${req.body.cardDesign}"`);
      } else {
        console.log(`⚠️  cardDesign 값 없음`);
      }

      const user = await User.update(req.user.id, req.body);

      // 디버깅: 업데이트 결과 로그
      console.log(
        `업데이트 결과:`,
        user ? `성공 (cardDesign: ${user.cardDesign})` : "실패"
      );
      console.log("==========================================\n");

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      res.json({
        success: true,
        data: userWithoutPassword,
      });
    } catch (error) {
      console.error("❌ [프로필 수정] 오류:", error.message);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

export default router;
