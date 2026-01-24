/**
 * LLM-based Relationship Analyzer
 * 피처 데이터를 LLM에게 전달하여 관계 분석
 * fact-extraction/lib/llm-client.js 패턴 사용
 */
import { generateJSON } from "./llm-client.js";

/**
 * LLM에게 관계 분석 요청
 * @param {Object} cardData - extractEssentialDataForLLM 결과
 * @param {Object} features - extractFeaturesForCard 결과
 * @returns {Object} LLM의 관계 분석 결과
 */
export async function analyzeRelationshipWithLLM(cardData, features) {
  const prompt = buildAnalysisPrompt(cardData, features);
  
  const systemPrompt = `당신은 인간 관계 분석 전문가입니다. 
주어진 데이터를 바탕으로 사용자와 해당 인물 간의 관계를 분석해주세요.

## 관계 유형 분류 기준 (반드시 아래 6가지 중 하나로 분류)

**핵심**: 가장 중요한 비즈니스 관계 (Key Account)
- 미팅 횟수가 많고 최근에도 활발함
- 선물 교환이 있거나 총 상호작용이 높음
- 즐겨찾기 되어 있거나 메모가 많음
- 예: VIP 고객, 핵심 파트너, 중요 거래처

**협력**: 프로젝트/업무 협력 관계
- 정기적인 미팅이 있음
- 일정에 프로젝트, 회의, 협업 관련 내용
- 예: 프로젝트 팀원, 협력사, 동료

**네트워킹**: 인맥 관리 차원의 관계
- 미팅 횟수는 적지만 꾸준히 연락 유지
- 명절, 기념일 등에 선물/연락
- 예: 업계 지인, 세미나에서 만난 사람, 소개받은 인맥

**신규**: 최근에 형성된 관계
- 명함 등록 경과일이 짧음 (30일 이내)
- 아직 상호작용이 많지 않음
- 예: 최근 미팅한 잠재 고객, 신규 거래처

**개인**: 비즈니스 외 개인적 관계
- 업무와 무관한 만남이 많음
- 개인적인 메모/fact (취미, 가족, 생일 등)
- 예: 친구, 가족, 동창

**휴면**: 과거 활발했으나 현재 소원한 관계
- 마지막 미팅 경과일이 김 (90일 이상)
- 최근 30일/90일 상호작용이 없음
- 총 상호작용은 있지만 최근성 낮음
- 예: 이전 거래처, 과거 동료

## 클러스터 분류 시 주의사항
- 모든 관계를 "핵심"이나 "휴면"에만 분류하지 마세요
- 데이터를 면밀히 분석하여 6가지 유형에 골고루 분류해주세요
- 각 유형의 기준을 엄격히 적용하세요

반드시 아래 JSON 형식으로만 응답하세요:
{
  "relationshipScore": 0-100 사이 정수,
  "relationshipType": "핵심" | "협력" | "네트워킹" | "신규" | "개인" | "휴면",
  "clusterReason": "이 클러스터로 분류한 이유 (1문장)",
  "grade": "A" | "B" | "C" | "D" | "F",
  "summary": "관계에 대한 한 줄 요약",
  "reasoning": "점수와 유형을 결정한 근거 (2-3문장)",
  "strengths": ["관계의 강점 1", "강점 2"],
  "improvements": ["관계 개선 제안 1", "제안 2"],
  "interactionPattern": "상호작용 패턴 설명",
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "lastInteractionDays": 마지막 상호작용 후 경과일 (숫자)
}`;
  
  try {
    const analysis = await generateJSON(prompt, {
      systemPrompt,
      temperature: 0.3,
      maxTokens: 1000,
    });
    
    // 등급 라벨 추가
    analysis.gradeLabel = getGradeLabel(analysis.grade);
    analysis.gradeColor = getGradeColor(analysis.grade);
    
    return {
      cardId: cardData.cardId,
      cardInfo: cardData.basicInfo,
      analysis,
      analyzedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("LLM 관계 분석 오류:", error);
    throw error;
  }
}

/**
 * 분석 프롬프트 생성
 */
function buildAnalysisPrompt(cardData, features) {
  const { basicInfo, recentMemos, recentEvents, recentGifts, topFacts } = cardData;
  const f = features.features;
  
  let prompt = `## 분석 대상 인물 정보
- 이름: ${basicInfo.name}
- 회사: ${basicInfo.company || '정보 없음'}
- 직책: ${basicInfo.position || '정보 없음'}
- 성별: ${basicInfo.gender || '정보 없음'}
- 메모: ${basicInfo.memo || '없음'}

## 상호작용 통계
- 총 미팅 횟수: ${f.totalMeetings || 0}회
- 최근 30일 미팅: ${f.meetingsLast30Days || 0}회
- 최근 90일 미팅: ${f.meetingsLast90Days || 0}회
- 마지막 미팅 후 경과일: ${f.daysSinceLastMeeting || '정보 없음'}일
- 평균 미팅 시간: ${f.avgMeetingDuration || 0}분

## 메모 활동
- 총 메모 수: ${f.totalMemos || 0}개
- 최근 30일 메모: ${f.memosLast30Days || 0}개
- 평균 메모 길이: ${f.avgMemoLength || 0}자

## 선물 이력
- 총 선물 횟수: ${f.totalGifts || 0}회
- 총 선물 금액: ${f.totalGiftValue ? f.totalGiftValue.toLocaleString() + '원' : '0원'}
- 평균 선물 금액: ${f.avgGiftPrice ? f.avgGiftPrice.toLocaleString() + '원' : '0원'}
- 선물 상황 다양성: ${f.giftOccasionDiversity || 0}종류

## 채팅 이력
- 총 채팅 횟수: ${f.totalChats || 0}회
- 평균 메시지 수: ${f.avgMessagesPerChat || 0}개

## 추출된 Fact 정보
- 총 fact 수: ${f.totalFacts || 0}개
- 선호도 정보: ${f.preferenceCount || 0}개
- 리스크 정보: ${f.riskCount || 0}개
- 긍정 polarity: ${f.positivePolarity || 0}개
- 부정 polarity: ${f.negativePolarity || 0}개
- 평균 신뢰도: ${f.avgConfidence || 0}

## 기타 정보
- 명함 등록 후 경과일: ${f.daysSinceCreation || 0}일
- 즐겨찾기 여부: ${f.isFavorite ? '예' : '아니오'}
`;

  // 최근 메모 추가
  if (recentMemos && recentMemos.length > 0) {
    prompt += `\n## 최근 메모 내용\n`;
    recentMemos.forEach((memo, i) => {
      prompt += `${i + 1}. ${memo.content}\n`;
    });
  }
  
  // 최근 일정 추가
  if (recentEvents && recentEvents.length > 0) {
    prompt += `\n## 최근 일정\n`;
    recentEvents.forEach((event, i) => {
      prompt += `${i + 1}. [${event.category}] ${event.title}${event.memo ? ` - ${event.memo}` : ''}\n`;
    });
  }
  
  // 최근 선물 추가
  if (recentGifts && recentGifts.length > 0) {
    prompt += `\n## 최근 선물\n`;
    recentGifts.forEach((gift, i) => {
      prompt += `${i + 1}. ${gift.giftName} (${gift.occasion}, ${gift.price?.toLocaleString() || 0}원)\n`;
    });
  }
  
  // 주요 Fact 추가
  if (topFacts && topFacts.length > 0) {
    prompt += `\n## 주요 Fact (신뢰도 높은 순)\n`;
    topFacts.forEach((fact, i) => {
      const polarity = fact.polarity === 1 ? '긍정' : fact.polarity === -1 ? '부정' : '중립';
      prompt += `${i + 1}. [${fact.type}] ${fact.key} (${polarity}, 신뢰도 ${Math.round(fact.confidence * 100)}%)\n`;
    });
  }
  
  prompt += `\n위 데이터를 종합하여 이 인물과 사용자 간의 관계를 분석해주세요.`;
  
  return prompt;
}

/**
 * 여러 카드의 관계를 일괄 분석
 */
export async function analyzeMultipleRelationships(cardsData) {
  const results = [];
  
  for (const { cardData, features } of cardsData) {
    try {
      const analysis = await analyzeRelationshipWithLLM(cardData, features);
      results.push(analysis);
      
      // Rate limit 방지
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`카드 ${cardData.cardId} 분석 실패:`, error.message);
      results.push({
        cardId: cardData.cardId,
        cardInfo: cardData.basicInfo,
        error: error.message
      });
    }
  }
  
  // 점수순 정렬
  results.sort((a, b) => {
    const scoreA = a.analysis?.relationshipScore || 0;
    const scoreB = b.analysis?.relationshipScore || 0;
    return scoreB - scoreA;
  });
  
  // 순위 추가
  results.forEach((r, i) => {
    if (r.analysis) {
      r.rank = i + 1;
    }
  });
  
  return results;
}

/**
 * 관계 비교 분석 (두 사람 비교)
 */
export async function compareRelationships(card1Data, card2Data, features1, features2) {
  const prompt = `
## 두 인물 간의 관계 비교 분석

### 인물 A: ${card1Data.basicInfo.name}
- 회사: ${card1Data.basicInfo.company || '정보 없음'}
- 총 미팅: ${features1.features.totalMeetings || 0}회
- 총 메모: ${features1.features.totalMemos || 0}개
- 총 선물: ${features1.features.totalGifts || 0}회
- 총 Fact: ${features1.features.totalFacts || 0}개

### 인물 B: ${card2Data.basicInfo.name}
- 회사: ${card2Data.basicInfo.company || '정보 없음'}
- 총 미팅: ${features2.features.totalMeetings || 0}회
- 총 메모: ${features2.features.totalMemos || 0}개
- 총 선물: ${features2.features.totalGifts || 0}회
- 총 Fact: ${features2.features.totalFacts || 0}개

두 인물과의 관계를 비교 분석해주세요.
`;

  const systemPrompt = `당신은 인간 관계 분석 전문가입니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "comparison": "전체적인 비교 설명",
  "personA": {
    "score": 0-100,
    "strengths": ["강점"],
    "relationshipType": "유형"
  },
  "personB": {
    "score": 0-100,
    "strengths": ["강점"],
    "relationshipType": "유형"
  },
  "recommendation": "관계 관리 제안"
}`;

  try {
    return await generateJSON(prompt, {
      systemPrompt,
      temperature: 0.3,
    });
  } catch (error) {
    console.error("비교 분석 오류:", error);
    throw error;
  }
}

/**
 * 등급 라벨
 */
function getGradeLabel(grade) {
  const labels = {
    A: "매우 친밀",
    B: "친밀",
    C: "보통",
    D: "소원",
    F: "거의 없음"
  };
  return labels[grade] || "알 수 없음";
}

/**
 * 등급 색상
 */
function getGradeColor(grade) {
  const colors = {
    A: "#22c55e",
    B: "#84cc16",
    C: "#eab308",
    D: "#f97316",
    F: "#ef4444"
  };
  return colors[grade] || "#888888";
}

/**
 * 분석 결과 요약 생성
 */
export function summarizeAnalysisResults(results) {
  const validResults = results.filter(r => r.analysis);
  
  if (validResults.length === 0) {
    return { error: "분석된 결과가 없습니다." };
  }
  
  const scores = validResults.map(r => r.analysis.relationshipScore);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  // 등급 분포
  const gradeDistribution = {};
  for (const r of validResults) {
    const grade = r.analysis.grade;
    gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
  }
  
  // 관계 유형 분포
  const typeDistribution = {};
  for (const r of validResults) {
    const type = r.analysis.relationshipType;
    typeDistribution[type] = (typeDistribution[type] || 0) + 1;
  }
  
  // 감정 분포
  const sentimentDistribution = {};
  for (const r of validResults) {
    const sentiment = r.analysis.sentiment;
    sentimentDistribution[sentiment] = (sentimentDistribution[sentiment] || 0) + 1;
  }
  
  return {
    totalAnalyzed: validResults.length,
    avgScore: Math.round(avgScore * 100) / 100,
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    gradeDistribution,
    typeDistribution,
    sentimentDistribution,
    topRelationships: validResults.slice(0, 5).map(r => ({
      name: r.cardInfo?.name,
      score: r.analysis.relationshipScore,
      type: r.analysis.relationshipType,
      summary: r.analysis.summary
    }))
  };
}

