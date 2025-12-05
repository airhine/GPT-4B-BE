import express from 'express';
import { body, validationResult } from 'express-validator';
import Gift from '../models/Gift.model.js';
import BusinessCard from '../models/BusinessCard.model.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { processPersonaEmbedding, generateEmbedding, rerankGifts, generateGiftRationale } from '../services/llm.service.js';
import { searchSimilarGifts } from '../services/chromadb.service.js';

const router = express.Router();

router.use(authenticate);

// @route   GET /api/gifts
// @desc    Get all gifts for user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { cardId, year } = req.query;

    const gifts = await Gift.findByUserId(req.user.id, { cardId, year });

    res.json({
      success: true,
      data: gifts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/gifts
// @desc    Create new gift record
// @access  Private
router.post('/', [
  body('cardId').notEmpty(),
  body('giftName').notEmpty().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const gift = await Gift.create({
      ...req.body,
      userId: req.user.id,
      year: new Date().getFullYear().toString(),
    });

    res.status(201).json({
      success: true,
      data: gift
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/gifts/recommend
// @desc    Get gift recommendations using LLM and generate persona embedding
// @access  Private
router.post('/recommend', [
  body('cardId').notEmpty(),
  body('additionalInfo').optional(),
  body('gender').optional(),
  body('memos').optional().isArray(),
  body('minPrice').optional().isFloat(),
  body('maxPrice').optional().isFloat(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      cardId,
      additionalInfo = '',
      gender = '',
      memos = [],
      minPrice = null,
      maxPrice = null,
    } = req.body;

    // Get business card information
    const card = await BusinessCard.findById(cardId, req.user.id);

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Business card not found'
      });
    }

    // Prepare persona data
    // Use DB's card.gender if available, otherwise use request body's gender
    const finalGender = card.gender || gender || '';
    const rank = card.position || '';
    const primaryMemo = memos.length > 0 ? memos[0] : '';
    const addMemo = additionalInfo || '';

    // Generate persona embedding string using GPT-4o-mini
    const personaString = await processPersonaEmbedding({
      rank,
      gender: finalGender,
      memo: primaryMemo,
      addMemo,
    });

    // Convert personaString to embedding vector using OpenAI Embedding API
    const embeddingVector = await generateEmbedding(
      personaString,
      "text-embedding-3-small",
      1536
    );

    // Search for similar gifts in ChromaDB using cosine similarity
    const minPriceNum =
      Number.isFinite(parseFloat(minPrice)) && !Number.isNaN(parseFloat(minPrice))
        ? parseFloat(minPrice) * 10000 // 입력 단위: 만원 -> 원
        : null;
    const maxPriceNum =
      Number.isFinite(parseFloat(maxPrice)) && !Number.isNaN(parseFloat(maxPrice))
        ? parseFloat(maxPrice) * 10000
        : null;

    // 코사인 유사도로 상위 5개 후보 선정 -> 리랭킹 후 3개로 축소
    const searchResults = await searchSimilarGifts(
      embeddingVector,
      5, // 코사인 유사도로 5개 선정
      minPriceNum,
      maxPriceNum
    );

    // Format search results
    const allRecommendedGifts = [];
    if (searchResults.ids && searchResults.ids[0]) {
      const ids = searchResults.ids[0];
      const metadatas = searchResults.metadatas[0] || [];
      const distances = searchResults.distances[0] || [];
      const documents = searchResults.documents[0] || [];

      for (let i = 0; i < ids.length; i++) {
        allRecommendedGifts.push({
          id: ids[i],
          metadata: metadatas[i] || {},
          distance: distances[i] || null,
          document: documents[i] || "",
          similarity: distances[i] !== null ? 1 - distances[i] : null, // Convert distance to similarity
        });
      }
    }

    // 리랭킹: 코사인 유사도로 선정된 5개 후보 중에서 사용자 입력 기반으로 최종 3개 선정
    const top3Gifts = await rerankGifts(
      allRecommendedGifts, // 5개 후보
      personaString, 
      {
        rank,
        gender: finalGender,
        memo: primaryMemo,
        addMemo,
      },
      3 // 최종 3개로 축소
    );

    // LLM을 사용하여 각 선물에 대한 rationale 생성 (RAG 기반 reasoning)
    const rationaleCards = await Promise.all(
      top3Gifts.map(async (gift, idx) => {
        try {
          const rationale = await generateGiftRationale(
            gift,
            personaString,
            {
              rank,
              gender: finalGender,
              memo: primaryMemo,
              addMemo,
            }
          );

          return {
            id: idx + 1,
            title: rationale.title,
            description: rationale.description,
          };
        } catch (error) {
          console.error(`Error generating rationale for gift ${idx}:`, error);
          // Fallback
          const meta = gift.metadata || {};
          return {
            id: idx + 1,
            title: meta.category || '추천 선물',
            description: `${personaString}에 맞춰 추천드립니다.`,
          };
        }
      })
    );

    res.json({
      success: true,
      data: {
        personaString,
        recommendedGifts: top3Gifts,
        rationaleCards,
        card,
        originalData: {
          rank,
          gender: finalGender,
          memo: primaryMemo,
          addMemo,
        }
      }
    });
  } catch (error) {
    console.error('Gift recommendation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Gift recommendation failed'
    });
  }
});

export default router;

