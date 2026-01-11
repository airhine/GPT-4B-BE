/**
 * 구조화된 로깅 유틸리티
 */
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const CURRENT_LOG_LEVEL_NUM = LOG_LEVELS[CURRENT_LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * 로그 레벨 확인
 */
const shouldLog = (level) => {
  return LOG_LEVELS[level.toUpperCase()] <= CURRENT_LOG_LEVEL_NUM;
};

/**
 * 로그 포맷팅
 */
const formatLog = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (data) {
    return `${prefix} ${message}\n${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`;
  }
  return `${prefix} ${message}`;
};

/**
 * 로깅 유틸리티 객체
 */
export const logger = {
  error: (message, data = null) => {
    if (shouldLog('ERROR')) {
      console.error(formatLog('ERROR', message, data));
    }
  },
  
  warn: (message, data = null) => {
    if (shouldLog('WARN')) {
      console.warn(formatLog('WARN', message, data));
    }
  },
  
  info: (message, data = null) => {
    if (shouldLog('INFO')) {
      console.log(formatLog('INFO', message, data));
    }
  },
  
  debug: (message, data = null) => {
    if (shouldLog('DEBUG')) {
      console.log(formatLog('DEBUG', message, data));
    }
  },
  
  /**
   * 선물 추천 관련 구조화된 로깅
   */
  gift: {
    start: (endpoint, data) => {
      logger.info(`🔍 [${endpoint}] 요청 시작`, data);
    },
    
    step: (stepName, message, data = null) => {
      logger.info(`[${stepName}] ${message}`, data);
    },
    
    success: (message, data = null) => {
      logger.info(`✅ ${message}`, data);
    },
    
    info: (message, data = null) => {
      logger.info(message, data);
    },
    
    debug: (message, data = null) => {
      logger.debug(message, data);
    },
    
    error: (message, error) => {
      logger.error(`❌ ${message}`, { message: error.message, stack: error.stack });
    },
    
    warn: (message, data = null) => {
      logger.warn(`⚠️  ${message}`, data);
    },
  },
};

export default logger;
