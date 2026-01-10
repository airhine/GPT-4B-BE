import express from 'express';
import { body, validationResult } from 'express-validator';
import Memo from '../models/Memo.model.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// 모든 라우트에 인증 적용
router.use(authenticate);

// @route   POST /api/memo
// @desc    Create new memo
// @access  Private
router.post(
  '/',
  [
    body('user_id').notEmpty().withMessage('user_id is required'),
    body('business_card_id').notEmpty().withMessage('business_card_id is required'),
    body('content').notEmpty().trim().withMessage('content is required'),
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

      const { user_id, business_card_id, content } = req.body;

      const memo = await Memo.create({
        userId: user_id,
        businessCardId: business_card_id,
        content,
      });

      res.status(201).json({
        success: true,
        data: memo,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// @route   GET /api/memo/business-card/:business_card_id
// @desc    Get all memos for a business card (order by updated_at desc)
// @access  Private
router.get('/business-card/:business_card_id', async (req, res) => {
  try {
    const { business_card_id } = req.params;

    const memos = await Memo.findByBusinessCardId(
      parseInt(business_card_id, 10),
      req.user.id
    );

    res.json({
      success: true,
      data: memos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   PUT /api/memo/:id
// @desc    Update memo content
// @access  Private
router.put(
  '/:id',
  [body('content').notEmpty().trim().withMessage('content is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const { content } = req.body;

      const memo = await Memo.update(id, req.user.id, content);

      if (!memo) {
        return res.status(404).json({
          success: false,
          message: 'Memo not found',
        });
      }

      res.json({
        success: true,
        data: memo,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// @route   DELETE /api/memo/:id
// @desc    Delete memo
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Memo.delete(id, req.user.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Memo not found',
      });
    }

    res.json({
      success: true,
      message: 'Memo deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
