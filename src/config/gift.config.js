/**
 * 선물 추천 시스템 설정
 */
export const GIFT_CONFIG = {
  // 리랭킹 설정
  DEFAULT_TOP_N: 3,
  RERANK_THRESHOLD: 3, // 이 개수 초과시 리랭킹 수행
  
  // 검색 설정
  DEFAULT_SEARCH_LIMIT: 5,
  MAX_SEARCH_LIMIT: 20,
  CHROMADB_DEFAULT_LIMIT: 5,
  
  // 네이버 검색 설정
  NAVER_SEARCH_DELAY_MS: 300,
  NAVER_MIN_RESULTS: 3,
  NAVER_MAX_KEYWORDS: 3,
  NAVER_FALLBACK_KEYWORDS: ["선물", "기프트", "선물세트"],
  NAVER_SEARCH_STRATEGIES: [
    { display: 30, sort: "sim", desc: "정확도순 (display=30)" },
    { display: 50, sort: "sim", desc: "정확도순 (display=50)" },
    { display: 50, sort: "date", desc: "날짜순" },
  ],
  
  // LLM 설정
  LLM_TIMEOUT_MS: 30000, // 30초
  LLM_EMBEDDING_MODEL: "text-embedding-3-small",
  LLM_EMBEDDING_DIMENSIONS: 1536,
  LLM_CHAT_MODEL: "gpt-4o-mini",
  LLM_RERANK_TEMPERATURE: 0.0,
  LLM_RATIONALE_TEMPERATURE: 0.1,
  LLM_RATIONALE_MAX_TOKENS: 200,
  LLM_RERANK_MAX_TOKENS: 100,
  
  // 문서/텍스트 길이 제한
  RATIONALE_DOCUMENT_MAX_LENGTH: 500,
  RERANK_DESCRIPTION_MAX_LENGTH: 200,
  PERSONA_PREVIEW_LENGTH: 100,
  
  // 가격 변환
  PRICE_WON_MULTIPLIER: 10000, // 만원 → 원 변환
  
  // 캐싱 설정
  CACHE_TTL_SECONDS: 3600, // 1시간
  CACHE_ENABLED: process.env.REDIS_URL || process.env.REDIS_HOST ? true : false,
};

/**
 * 로그 레벨
 */
export const LOG_LEVEL = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};
