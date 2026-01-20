/**
 * 관계 친밀도 계산 유틸리티
 * 하이브리드 다양성 방식 + confidence 반영
 */

/**
 * Confidence를 가중치로 변환
 * @param {number} confidence - 0.0 ~ 1.0
 * @returns {number} 0.7 ~ 1.0 범위의 가중치
 */
function getConfidenceMultiplier(confidence) {
  // confidence가 null이거나 undefined인 경우 기본값 0.7 사용
  const conf = confidence ?? 0.7;
  return 0.7 + (conf * 0.3);
}

/**
 * 특정 fact_type의 점수 계산 (confidence 반영)
 * @param {Array} facts - extracted_fact 배열
 * @param {string} factType - fact_type
 * @param {number} baseWeight - 기본 가중치
 * @returns {number} 계산된 점수
 */
export function calculateTypeScore(facts, factType, baseWeight) {
  const typeFacts = facts.filter(f => f.fact_type === factType);
  
  return typeFacts.reduce((sum, fact) => {
    const confidenceMultiplier = getConfidenceMultiplier(fact.confidence);
    return sum + (baseWeight * confidenceMultiplier);
  }, 0);
}

/**
 * 최근성 보너스 계산
 * @param {Array} sourceEvents - source_event 배열
 * @returns {number} 최근성 보너스 점수
 */
export function calculateRecencyBonus(sourceEvents) {
  if (!sourceEvents || sourceEvents.length === 0) return 0;
  
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  
  const recentEvents = sourceEvents.filter(event => {
    const eventTime = new Date(event.occurred_at).getTime();
    return eventTime >= thirtyDaysAgo;
  });
  
  return recentEvents.length * 2.0;
}

/**
 * 하이브리드 다양성 점수 계산 (confidence 반영)
 * @param {Array} facts - extracted_fact 배열
 * @returns {number} 다양성 점수
 */
export function calculateHybridDiversity(facts) {
  const typeWeights = {
    'INTERACTION': 1.0,
    'PREFERENCE': 0.8,
    'DATE': 0.6,
    'CONTEXT': 0.4,
    'ROLE_OR_ORG': 0.2
  };
  
  const maxWeight = Object.values(typeWeights).reduce((a, b) => a + b, 0); // 3.0
  
  // 존재하는 타입들의 가중치 합 계산
  const presentTypes = new Set(
    facts
      .filter(f => typeWeights[f.fact_type])
      .map(f => f.fact_type)
  );
  
  let weightedSum = 0;
  presentTypes.forEach(type => {
    weightedSum += typeWeights[type];
  });
  
  // 정규화된 가중치 비율
  const normalizedRatio = maxWeight > 0 ? weightedSum / maxWeight : 0;
  
  // confidence를 반영한 가중 fact 개수
  const weightedFactCount = facts
    .filter(f => typeWeights[f.fact_type])
    .reduce((sum, fact) => {
      const confidenceMultiplier = getConfidenceMultiplier(fact.confidence);
      return sum + confidenceMultiplier;
    }, 0);
  
  // 최종 다양성 점수
  return normalizedRatio * weightedFactCount * 0.3;
}

/**
 * 전체 친밀도 점수 계산
 * @param {Array} facts - extracted_fact 배열
 * @param {Array} sourceEvents - source_event 배열 (최근성 계산용)
 * @returns {number} 친밀도 점수
 */
export function calculateIntimacyScore(facts, sourceEvents = []) {
  if (!facts || facts.length === 0) return 0;
  
  let score = 0;
  
  // fact_type별 점수 계산 (confidence 반영)
  score += calculateTypeScore(facts, 'INTERACTION', 5.0);
  score += calculateTypeScore(facts, 'PREFERENCE', 3.0);
  score += calculateTypeScore(facts, 'DATE', 2.0);
  score += calculateTypeScore(facts, 'CONTEXT', 1.5);
  score += calculateTypeScore(facts, 'ROLE_OR_ORG', 1.0);
  
  // 최근성 보너스
  score += calculateRecencyBonus(sourceEvents);
  
  // 하이브리드 다양성 점수
  score += calculateHybridDiversity(facts);
  
  return Math.max(0, score); // 음수 방지
}
