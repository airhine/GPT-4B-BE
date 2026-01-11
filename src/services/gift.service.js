import PreferenceProfile from "../models/PreferenceProfile.model.js";
import { rerankGifts, generateGiftRationale } from "./llm.service.js";
import { GIFT_CONFIG } from "../config/gift.config.js";
import { logger } from "../utils/logger.js";
import { validatePreferenceProfile, getPreferencePriority, sortPreferenceItemsByWeight } from "../utils/preferenceValidator.js";

/**
 * 선호도 프로필 데이터 조회
 * @param {string|number} cardId - 명함 ID
 * @returns {Promise<Object|null>} 프로필 데이터 또는 null
 */
export const fetchPreferenceProfile = async (cardId) => {
  if (!cardId) {
    return null;
  }

  try {
    const businessCardId = parseInt(cardId, 10);
    if (isNaN(businessCardId)) {
      logger.gift.warn(`유효하지 않은 cardId: ${cardId}`);
      return null;
    }

    logger.gift.step("프로필 조회", `선호도 프로필 데이터 조회 중... (cardId: ${businessCardId})`);
    const profile = await PreferenceProfile.findByBusinessCardId(businessCardId);
    
    if (profile) {
      const preferenceProfile = {
        likes: profile.likes ? (typeof profile.likes === 'string' ? JSON.parse(profile.likes) : profile.likes) : [],
        dislikes: profile.dislikes ? (typeof profile.dislikes === 'string' ? JSON.parse(profile.dislikes) : profile.dislikes) : [],
        uncertain: profile.uncertain ? (typeof profile.uncertain === 'string' ? JSON.parse(profile.uncertain) : profile.uncertain) : [],
      };
      
      // 검증
      const validation = validatePreferenceProfile(preferenceProfile);
      if (!validation.isValid) {
        logger.gift.warn("프로필 데이터 검증 실패", { errors: validation.errors });
        // 검증 실패해도 기본 구조는 반환 (빈 배열로)
        return {
          likes: Array.isArray(preferenceProfile.likes) ? preferenceProfile.likes : [],
          dislikes: Array.isArray(preferenceProfile.dislikes) ? preferenceProfile.dislikes : [],
          uncertain: Array.isArray(preferenceProfile.uncertain) ? preferenceProfile.uncertain : [],
        };
      }
      
      // 신뢰도 순으로 정렬
      preferenceProfile.likes = sortPreferenceItemsByWeight(preferenceProfile.likes);
      preferenceProfile.dislikes = sortPreferenceItemsByWeight(preferenceProfile.dislikes);
      preferenceProfile.uncertain = sortPreferenceItemsByWeight(preferenceProfile.uncertain);
      
      logger.gift.success(
        `프로필 데이터 조회 완료: Likes ${preferenceProfile.likes.length}개, Dislikes ${preferenceProfile.dislikes.length}개, Uncertain ${preferenceProfile.uncertain.length}개`
      );
      return preferenceProfile;
    } else {
      logger.gift.info("프로필 데이터 없음 (메모 기반 프로필이 생성되지 않음)");
      return null;
    }
  } catch (profileError) {
    logger.gift.error("프로필 데이터 조회 실패", profileError);
    return null;
  }
};

/**
 * Preference Profile 우선순위 확인 및 로깅
 * @param {Object|null} preferenceProfile - 프로필 데이터
 * @param {Object} memoData - 메모 데이터
 * @returns {Object} 우선순위 정보
 */
export const checkPreferencePriority = (preferenceProfile, memoData) => {
  const priority = getPreferencePriority(preferenceProfile, memoData);
  logger.gift.debug("Preference priority check", priority);
  return priority;
};

/**
 * 선물 리랭킹 및 추천 이유 생성
 * @param {Array} allGifts - 전체 선물 목록
 * @param {string} personaString - 페르소나 문자열
 * @param {Object} personaData - 페르소나 데이터
 * @param {Object|null} preferenceProfile - 선호도 프로필
 * @param {number} topN - 상위 N개 (기본값: 3)
 * @param {string} searchQuery - 검색어 (fallback용, 선택사항)
 * @param {string} fallbackDesc - Fallback 설명 (searchQuery가 없을 때 사용)
 * @returns {Promise<{recommendedGifts: Array, rationaleCards: Array}>}
 */
export const performRerankingAndGenerateRationale = async (
  allGifts,
  personaString,
  personaData,
  preferenceProfile = null,
  topN = GIFT_CONFIG.DEFAULT_TOP_N,
  searchQuery = "",
  fallbackDesc = ""
) => {
  let recommendedGifts = allGifts;
  let rationaleCards = [];

  // 결과가 임계값 초과일 경우 LLM 리랭킹 수행
  if (allGifts.length > GIFT_CONFIG.RERANK_THRESHOLD) {
    try {
      logger.gift.step(
        "리랭킹",
        `LLM 리랭킹 수행 중... (${allGifts.length}개 → ${topN}개)`,
        { hasProfile: !!preferenceProfile }
      );
      const rerankStartTime = Date.now();
      
      recommendedGifts = await rerankGifts(
        allGifts,
        personaString,
        personaData,
        topN,
        preferenceProfile
      );
      
      const rerankTime = Date.now() - rerankStartTime;
      logger.gift.success(`리랭킹 완료: 상위 ${topN}개 선정 (소요: ${rerankTime}ms)`);
    } catch (error) {
      logger.gift.error("리랭킹 실패, 상위 N개 사용", error);
      recommendedGifts = allGifts.slice(0, topN);
      rationaleCards = recommendedGifts.map((gift, idx) => ({
        id: idx + 1,
        title: gift.metadata?.category?.split(" > ")[0] || "추천 선물",
        description: searchQuery 
          ? `"${searchQuery}" 검색 결과로 추천드립니다.` 
          : (fallbackDesc || "추천 선물입니다."),
      }));
      return { recommendedGifts, rationaleCards };
    }
  } else {
    logger.gift.info(`결과가 ${allGifts.length}개 (${GIFT_CONFIG.RERANK_THRESHOLD}개 이하), 리랭킹 생략`);
    rationaleCards = recommendedGifts.map((gift, idx) => ({
      id: idx + 1,
      title: gift.metadata?.category?.split(" > ")[0] || "추천 선물",
      description: searchQuery 
        ? `"${searchQuery}" 검색 결과로 추천드립니다.` 
        : (fallbackDesc || "추천 선물입니다."),
    }));
    return { recommendedGifts, rationaleCards };
  }

  // 추천 이유 생성
  logger.gift.step("추천 이유 생성", "추천 이유 생성 중...");
  const rationaleStartTime = Date.now();
  
  rationaleCards = await Promise.all(
    recommendedGifts.map(async (gift, idx) => {
      try {
        const rationale = await generateGiftRationale(
          gift,
          personaString,
          personaData
        );
        return {
          id: idx + 1,
          title: rationale.title,
          description: rationale.description,
        };
      } catch (error) {
        logger.gift.warn(`추천 이유 생성 실패 (인덱스 ${idx})`, error);
        const meta = gift.metadata || {};
        return {
          id: idx + 1,
          title: meta.category?.split(" > ")[0] || "추천 선물",
          description: searchQuery 
          ? `"${searchQuery}" 검색 결과로 추천드립니다.` 
          : (fallbackDesc || "추천 선물입니다."),
        };
      }
    })
  );
  
  const rationaleTime = Date.now() - rationaleStartTime;
  logger.gift.success(`추천 이유 생성 완료: ${rationaleCards.length}개 (소요: ${rationaleTime}ms)`);

  return { recommendedGifts, rationaleCards };
};

/**
 * 가격 변환 (만원 → 원)
 * @param {number|string|null} price - 만원 단위 가격
 * @returns {number|null} 원 단위 가격
 */
export const convertPriceToWon = (price) => {
  if (!price) return null;
  return parseFloat(price) * GIFT_CONFIG.PRICE_WON_MULTIPLIER;
};

/**
 * 선물 데이터 정규화 (응답 형식으로 변환)
 * @param {Array} gifts - 원본 선물 배열
 * @returns {Array} 정규화된 선물 배열
 */
export const normalizeGiftResponse = (gifts) => {
  return gifts.map((gift) => ({
    id: gift.id,
    name: gift.metadata?.name || gift.metadata?.product_name || gift.name || "",
    price: gift.metadata?.price || gift.price || "",
    image: gift.metadata?.image || gift.image || "",
    url: gift.metadata?.url || gift.metadata?.link || gift.url || "",
    category: gift.metadata?.category || gift.category || "",
    brand: gift.metadata?.brand || gift.brand || "",
    source: gift.source || "unknown",
  }));
};

/**
 * 선물 배열에서 중복 제거 (ID 및 이름 기준)
 * @param {Array} gifts - 선물 배열
 * @returns {Object} { uniqueGifts: Array, duplicates: Array }
 */
export const removeDuplicateGifts = (gifts) => {
  const uniqueGifts = [];
  const duplicates = [];
  const seenProductIds = new Set();
  const seenProductNames = new Set();

  for (const gift of gifts) {
    const productId = gift.id || gift.metadata?.productId || gift.metadata?.id;
    const productName = (
      gift.metadata?.name ||
      gift.metadata?.product_name ||
      gift.name ||
      ""
    )
      .trim()
      .toLowerCase();

    let isDuplicate = false;
    let duplicateReason = '';

    // 상품 ID로 중복 체크
    if (productId) {
      if (seenProductIds.has(productId)) {
        isDuplicate = true;
        duplicateReason = `ID 중복: ${productId}`;
      } else {
        seenProductIds.add(productId);
      }
    }

    // 상품 이름으로 중복 체크 (ID가 없거나 ID로 체크되지 않은 경우)
    if (!isDuplicate && productName) {
      if (seenProductNames.has(productName)) {
        isDuplicate = true;
        duplicateReason = `이름 중복: ${productName}`;
      } else {
        seenProductNames.add(productName);
      }
    }

    if (isDuplicate) {
      duplicates.push({
        gift,
        reason: duplicateReason,
      });
    } else {
      uniqueGifts.push(gift);
    }
  }

  if (duplicates.length > 0) {
    logger.debug(`중복 선물 제거: ${duplicates.length}개`, {
      duplicates: duplicates.map(d => ({
        name: d.gift.metadata?.name || d.gift.name,
        reason: d.reason,
      })),
    });
  }

  return { uniqueGifts, duplicates };
};
