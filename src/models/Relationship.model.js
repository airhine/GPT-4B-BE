import pool from "../config/database.js";
import {
  calculateIntimacyScore,
  calculateTypeScore
} from "../utils/relationshipCalculator.js";
import { processLLMChat } from "../services/llm.service.js";

class Relationship {
  /**
   * 특정 명함의 fact 목록 조회
   * @param {number} userId - 사용자 ID
   * @param {number} cardId - 명함 ID
   * @returns {Promise<Array>} fact 배열
   */
  static async getFactsByCardId(userId, cardId) {
    const query = `
      SELECT 
        ef.id,
        ef.source_event_id,
        ef.user_id,
        ef.card_id,
        ef.fact_type,
        ef.fact_key,
        ef.polarity,
        ef.confidence,
        ef.evidence,
        se.occurred_at
      FROM extracted_fact ef
      LEFT JOIN source_event se ON ef.source_event_id = se.id
      WHERE ef.user_id = ? AND ef.card_id = ?
      ORDER BY se.occurred_at DESC
    `;
    
    const [rows] = await pool.query(query, [userId, cardId]);
    return rows;
  }

  /**
   * 특정 명함의 source_event 목록 조회
   * @param {number} userId - 사용자 ID
   * @param {number} cardId - 명함 ID
   * @returns {Promise<Array>} source_event 배열
   */
  static async getSourceEventsByCardId(userId, cardId) {
    const query = `
      SELECT 
        id,
        user_id,
        card_id,
        source_type,
        source_pk,
        occurred_at,
        raw_text
      FROM source_event
      WHERE user_id = ? AND card_id = ?
      ORDER BY occurred_at DESC
    `;
    
    const [rows] = await pool.query(query, [userId, cardId]);
    return rows;
  }

  /**
   * 그래프 데이터 조회 (모든 명함에 대한 친밀도 계산)
   * @param {number} userId - 사용자 ID
   * @returns {Promise<Object>} 그래프 노드/엣지 데이터
   */
  static async getGraphData(userId) {
    // 1. 사용자의 모든 명함 조회 (isFavorite 포함)
    const cardsQuery = `
      SELECT id, name, design, isFavorite
      FROM business_cards
      WHERE userId = ?
    `;
    const [cards] = await pool.query(cardsQuery, [userId]);
    
    if (!cards || cards.length === 0) {
      return {
        nodes: [
          {
            id: `user-${userId}`,
            type: 'user',
            label: '나',
            x: 0,
            y: 0,
            fx: 0,
            fy: 0,
            radius: 30
          }
        ],
        links: []
      };
    }
    
    // 2. 각 명함에 대한 fact와 source_event 조회 및 친밀도 계산
    const nodes = [
      {
        id: `user-${userId}`,
        type: 'user',
        label: '나',
        x: 0,
        y: 0,
        fx: 0,
        fy: 0,
        radius: 30
      }
    ];
    
    const links = [];
    
    for (const card of cards) {
      const facts = await this.getFactsByCardId(userId, card.id);
      const sourceEvents = await this.getSourceEventsByCardId(userId, card.id);
      
      const intimacyScore = calculateIntimacyScore(facts, sourceEvents);
      
      // 명함 노드 추가
      nodes.push({
        id: `card-${card.id}`,
        type: 'card',
        label: card.name,
        cardId: card.id,
        design: card.design || 'design-1',
        isFavorite: Boolean(card.isFavorite === 1 || card.isFavorite === true), // MySQL BOOLEAN을 명시적으로 변환
        intimacyScore: Math.round(intimacyScore * 10) / 10, // 소수점 1자리
        radius: 40
      });
      
      // 사용자 → 명함 링크 추가 (명함끼리는 연결 안됨)
      // source와 target은 노드 ID 문자열로 저장 (d3-force가 자동으로 객체로 변환)
      links.push({
        source: `user-${userId}`,
        target: `card-${card.id}`,
        intimacyScore: Math.round(intimacyScore * 10) / 10
      });
    }
    
    // 최대 친밀도 점수 계산 (정규화용)
    const maxIntimacyScore = links.length > 0 
      ? Math.max(...links.map(l => l.intimacyScore || 0), 1)
      : 1;
    
    return { nodes, links, maxIntimacyScore };
  }

  /**
   * LLM 자연어 요약 생성
   * @param {number} userId - 사용자 ID
   * @param {number} contactId - 명함 ID
   * @param {Object} factTypeStats - fact 타입별 통계
   * @param {string} contactName - 명함 이름
   * @returns {Promise<Object>} LLM 요약 정보
   */
  static async generateLLMSummaries(userId, contactId, factTypeStats, contactName) {
    let overallSummary = '';
    const categorySummaries = {};
    
    try {
      // 종합 판단 생성 (구체적인 수치 제외)
      const overallPrompt = `다음은 ${contactName}님과의 관계 정보입니다.

상호작용 정보:
${factTypeStats.INTERACTION?.facts?.map(f => `- ${f.fact_key}`).join('\n') || '없음'}

선호도 정보:
${factTypeStats.PREFERENCE?.facts?.map(f => `- ${f.fact_key}`).join('\n') || '없음'}

중요 날짜:
${factTypeStats.DATE?.facts?.map(f => `- ${f.fact_key}`).join('\n') || '없음'}

배경 정보:
${factTypeStats.CONTEXT?.facts?.map(f => `- ${f.fact_key}`).join('\n') || '없음'}

역할/조직 정보:
${factTypeStats.ROLE_OR_ORG?.facts?.map(f => `- ${f.fact_key}`).join('\n') || '없음'}

위 정보를 바탕으로 ${contactName}님과의 관계를 종합적으로 판단하여 자연스러운 한국어로 요약해주세요. 구체적인 숫자나 수치는 언급하지 말고, 관계의 특성과 맥락을 중심으로 2-3문장으로 간결하게 작성해주세요.`;

      overallSummary = await processLLMChat([
        { role: 'user', content: overallPrompt }
      ], 'gpt');
    } catch (error) {
      console.error('종합 판단 LLM 호출 실패:', error);
      overallSummary = '';
    }
    
    // 각 카테고리별 자연어 요약 생성
    const categoryPrompts = {
      'INTERACTION': '상호작용',
      'PREFERENCE': '선호도',
      'DATE': '중요 날짜',
      'CONTEXT': '배경 정보',
      'ROLE_OR_ORG': '역할/조직'
    };
    
    for (const [type, label] of Object.entries(categoryPrompts)) {
      if (factTypeStats[type]?.facts && factTypeStats[type].facts.length > 0) {
        try {
          const categoryFacts = factTypeStats[type].facts;
          const highConfidenceFacts = categoryFacts.filter(f => f.confidence >= 0.7);
          const lowConfidenceFacts = categoryFacts.filter(f => f.confidence < 0.7);
          
          // 상호작용의 경우 특별한 프롬프트 사용
          let categoryPrompt
          if (type === 'INTERACTION') {
            categoryPrompt = `다음은 ${contactName}님과의 상호작용 정보입니다. 이는 나와 함께 있었던 일, 나와의 만남, 나와의 대화 등을 나타냅니다:

확실한 정보:
${highConfidenceFacts.map(f => `- ${f.fact_key}`).join('\n') || '없음'}

추정 정보:
${lowConfidenceFacts.map(f => `- ${f.fact_key}`).join('\n') || '없음'}

위 정보를 바탕으로 ${contactName}님과 나 사이의 상호작용(함께 있었던 일, 만남, 대화 등)에 대해 자연스러운 한국어로 요약해주세요. 구체적인 숫자나 수치는 언급하지 말고, 1-2문장으로 간결하게 작성해주세요. "~와 함께", "~와 만남", "~와의 대화" 같은 표현을 사용하여 나와의 관계를 중심으로 서술해주세요. 추정 정보는 "~로 보입니다", "~일 가능성이 있습니다" 같은 표현을 사용해주세요.`;
          } else {
            categoryPrompt = `${contactName}님의 ${label} 정보입니다:

확실한 정보:
${highConfidenceFacts.map(f => `- ${f.fact_key}`).join('\n') || '없음'}

추정 정보:
${lowConfidenceFacts.map(f => `- ${f.fact_key}`).join('\n') || '없음'}

위 정보를 바탕으로 ${label}에 대해 자연스러운 한국어로 요약해주세요. 구체적인 숫자나 수치는 언급하지 말고, 1-2문장으로 간결하게 작성해주세요. 추정 정보는 "~로 보입니다", "~일 가능성이 있습니다" 같은 표현을 사용해주세요.`;
          }

          categorySummaries[type] = await processLLMChat([
            { role: 'user', content: categoryPrompt }
          ], 'gpt');
        } catch (error) {
          console.error(`${label} LLM 호출 실패:`, error);
          categorySummaries[type] = '';
        }
      }
    }
    
    return {
      overallSummary,
      categorySummaries
    };
  }

  /**
   * 관계 요약 정보 조회 (기본 정보만, LLM 없이)
   * @param {number} userId - 사용자 ID
   * @param {number} contactId - 명함 ID
   * @returns {Promise<Object>} 관계 요약 정보
   */
  static async getRelationshipSummary(userId, contactId) {
    // 명함 정보 조회
    const cardQuery = `
      SELECT id, name, design
      FROM business_cards
      WHERE id = ? AND userId = ?
    `;
    const [cards] = await pool.query(cardQuery, [contactId, userId]);
    
    if (!cards || cards.length === 0) {
      return null;
    }
    
    const card = cards[0];
    const facts = await this.getFactsByCardId(userId, contactId);
    const sourceEvents = await this.getSourceEventsByCardId(userId, contactId);
    
    const intimacyScore = calculateIntimacyScore(facts, sourceEvents);
    
    // fact_type별 통계 (신뢰도 정보 포함)
    const factTypeStats = {};
    const relevantTypes = ['INTERACTION', 'PREFERENCE', 'DATE', 'CONTEXT', 'ROLE_OR_ORG'];
    
    relevantTypes.forEach(type => {
      const typeFacts = facts.filter(f => f.fact_type === type);
      if (typeFacts.length > 0) {
        // 신뢰도 정보와 함께 facts 저장
        const factsWithConfidence = typeFacts.map(f => ({
          fact_key: f.fact_key,
          confidence: f.confidence || 0.7
        }));
        
        factTypeStats[type] = {
          count: typeFacts.length,
          facts: factsWithConfidence // 신뢰도 정보 포함
        };
      }
    });
    
    // 기본 정보는 즉시 반환 (LLM 없이도 가능한 정보)
    const baseData = {
      contactId: card.id,
      contactName: card.name,
      intimacyScore: Math.round(intimacyScore * 10) / 10,
      factTypeStats
    };
    
    // LLM 요약은 비동기로 생성 (별도 처리)
    // 프론트엔드에서 별도 API로 호출하거나, 여기서는 기본 정보만 반환
    
    return baseData;
  }
}

export default Relationship;
