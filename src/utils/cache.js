import crypto from 'crypto';
import { getRedisClient, isRedisAvailable } from '../config/redis.js';
import { logger } from './logger.js';

// Redis가 설치되지 않은 경우를 위한 fallback (in-memory cache for testing)
let memoryCache = new Map();

/**
 * 페르소나 데이터를 기반으로 캐시 키 생성
 * @param {Object} personaData - 페르소나 데이터
 * @param {number|null} minPrice - 최소 가격
 * @param {number|null} maxPrice - 최대 가격
 * @param {string} prefix - 캐시 키 prefix (기본: 'gift')
 * @returns {string} 캐시 키
 */
export const generateCacheKey = (personaData, minPrice = null, maxPrice = null, prefix = 'gift') => {
  const keyData = {
    rank: personaData.rank || '',
    gender: personaData.gender || '',
    memo: personaData.memo || '',
    addMemo: personaData.addMemo || '',
    minPrice: minPrice || 0,
    maxPrice: maxPrice || 0,
  };
  
  // 객체를 정렬된 JSON 문자열로 변환하여 일관된 키 생성
  const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
  
  // 해시 생성 (SHA256 사용)
  const hash = crypto.createHash('sha256').update(keyString).digest('hex').substring(0, 16);
  
  return `${prefix}:${hash}:${minPrice || 0}:${maxPrice || 0}`;
};

/**
 * 캐시에서 데이터 조회
 * @param {string} key - 캐시 키
 * @returns {Promise<Object|null>} 캐시된 데이터 또는 null
 */
export const getCache = async (key) => {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const redis = getRedisClient();
    const cached = await redis.get(key);
    if (cached) {
      logger.debug(`Cache hit: ${key}`);
      return JSON.parse(cached);
    }
    logger.debug(`Cache miss: ${key}`);
    return null;
  } catch (error) {
    logger.warn(`Cache get error: ${error.message}`);
    return null;
  }
};

/**
 * 캐시에 데이터 저장
 * @param {string} key - 캐시 키
 * @param {Object} data - 저장할 데이터
 * @param {number} ttl - TTL (초 단위, 기본: 3600 = 1시간)
 * @returns {Promise<boolean>} 성공 여부
 */
export const setCache = async (key, data, ttl = 3600) => {
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      await redis.setex(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      // Redis 오류 시 fallback
      return false;
    }
  }

  // Redis가 없는 경우 in-memory cache 사용 (개발 환경용)
  const expires = ttl > 0 ? Date.now() + ttl * 1000 : null;
  memoryCache.set(key, { data, expires });
  return true;
};

/**
 * 캐시 삭제
 * @param {string} key - 캐시 키
 * @returns {Promise<boolean>} 성공 여부
 */
export const deleteCache = async (key) => {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    await redis.del(key);
    logger.debug(`Cache delete: ${key}`);
    return true;
  } catch (error) {
    logger.warn(`Cache delete error: ${error.message}`);
    return false;
  }
};

/**
 * 패턴으로 캐시 삭제
 * @param {string} pattern - 패턴 (예: 'gift:*')
 * @returns {Promise<number>} 삭제된 키 개수
 */
export const deleteCacheByPattern = async (pattern) => {
  if (!isRedisAvailable()) {
    return 0;
  }

  try {
    const redis = getRedisClient();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug(`Cache delete by pattern: ${pattern} (${keys.length} keys)`);
      return keys.length;
    }
    return 0;
  } catch (error) {
    logger.warn(`Cache delete by pattern error: ${error.message}`);
    return 0;
  }
};
