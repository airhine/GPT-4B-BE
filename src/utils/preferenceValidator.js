import { logger } from './logger.js';

/**
 * Preference Profile 우선순위 규칙
 * 
 * 우선순위 (높은 순서부터):
 * 1. PreferenceProfile.likes (메모에서 추출된 선호 항목)
 * 2. PreferenceProfile.dislikes (메모에서 추출된 비선호 항목)
 * 3. PreferenceProfile.uncertain (메모에서 추출된 불확실한 선호도)
 * 4. Original memo/addMemo 데이터 (직접 입력된 메모)
 * 
 * 규칙:
 * - PreferenceProfile이 존재하면 항상 우선 사용
 * - PreferenceProfile의 likes/dislikes는 신뢰도(weight)가 높을수록 우선순위 높음
 * - PreferenceProfile과 메모 데이터가 충돌하는 경우, PreferenceProfile 우선
 * - PreferenceProfile이 없으면 메모 데이터 사용
 */

/**
 * Preference Profile 검증
 * @param {Object|null} preferenceProfile - 프로필 데이터
 * @returns {Object} 검증 결과 { isValid: boolean, errors: Array }
 */
export const validatePreferenceProfile = (preferenceProfile) => {
  const errors = [];

  if (!preferenceProfile) {
    return { isValid: true, errors: [] }; // null은 유효함 (프로필이 없는 경우)
  }

  // 필수 필드 확인
  const requiredFields = ['likes', 'dislikes', 'uncertain'];
  for (const field of requiredFields) {
    if (!(field in preferenceProfile)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // 타입 확인
  if (!Array.isArray(preferenceProfile.likes)) {
    errors.push('likes must be an array');
  }
  if (!Array.isArray(preferenceProfile.dislikes)) {
    errors.push('dislikes must be an array');
  }
  if (!Array.isArray(preferenceProfile.uncertain)) {
    errors.push('uncertain must be an array');
  }

  // 항목 검증
  const validateItems = (items, fieldName) => {
    items.forEach((item, index) => {
      if (typeof item !== 'object' || item === null) {
        errors.push(`${fieldName}[${index}] must be an object`);
        return;
      }
      if (!item.item || typeof item.item !== 'string') {
        errors.push(`${fieldName}[${index}].item must be a non-empty string`);
      }
      if (item.weight !== undefined) {
        if (typeof item.weight !== 'number' || item.weight < 0 || item.weight > 1) {
          errors.push(`${fieldName}[${index}].weight must be a number between 0 and 1`);
        }
      }
      if (item.evidence !== undefined && !Array.isArray(item.evidence)) {
        errors.push(`${fieldName}[${index}].evidence must be an array`);
      }
    });
  };

  if (Array.isArray(preferenceProfile.likes)) {
    validateItems(preferenceProfile.likes, 'likes');
  }
  if (Array.isArray(preferenceProfile.dislikes)) {
    validateItems(preferenceProfile.dislikes, 'dislikes');
  }
  if (Array.isArray(preferenceProfile.uncertain)) {
    validateItems(preferenceProfile.uncertain, 'uncertain');
  }

  const isValid = errors.length === 0;
  
  if (!isValid) {
    logger.warn('PreferenceProfile validation failed', { errors });
  }

  return { isValid, errors };
};

/**
 * Preference Profile과 메모 데이터의 우선순위 확인
 * @param {Object|null} preferenceProfile - 프로필 데이터
 * @param {Object} memoData - 메모 데이터 { memo: string, addMemo: string }
 * @returns {Object} 우선순위 정보 { useProfile: boolean, reason: string }
 */
export const getPreferencePriority = (preferenceProfile, memoData = {}) => {
  if (!preferenceProfile) {
    return {
      useProfile: false,
      reason: 'No preference profile available, using memo data',
    };
  }

  // PreferenceProfile이 있고 유효한 데이터가 있으면 항상 우선
  const hasLikes = preferenceProfile.likes && preferenceProfile.likes.length > 0;
  const hasDislikes = preferenceProfile.dislikes && preferenceProfile.dislikes.length > 0;
  const hasUncertain = preferenceProfile.uncertain && preferenceProfile.uncertain.length > 0;

  if (hasLikes || hasDislikes || hasUncertain) {
    return {
      useProfile: true,
      reason: 'Preference profile has data, using profile as primary source',
      hasLikes,
      hasDislikes,
      hasUncertain,
    };
  }

  // PreferenceProfile이 비어있으면 메모 데이터 사용
  const hasMemo = memoData.memo && memoData.memo.trim() && memoData.memo !== '정보없음';
  const hasAddMemo = memoData.addMemo && memoData.addMemo.trim() && memoData.addMemo !== '정보없음';

  if (hasMemo || hasAddMemo) {
    return {
      useProfile: false,
      reason: 'Preference profile is empty, falling back to memo data',
      hasMemo,
      hasAddMemo,
    };
  }

  return {
    useProfile: false,
    reason: 'No preference data available (profile empty and no memo)',
  };
};

/**
 * Preference Profile 항목 정렬 (신뢰도 높은 순서)
 * @param {Array} items - 프로필 항목 배열
 * @returns {Array} 정렬된 항목 배열
 */
export const sortPreferenceItemsByWeight = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return [...items].sort((a, b) => {
    const weightA = a.weight || 0.5;
    const weightB = b.weight || 0.5;
    return weightB - weightA; // 높은 신뢰도 순서
  });
};
