/**
 * LLM 클라이언트 모듈
 * OpenAI API를 사용하여 시나리오 생성 및 fact 추출
 * - 기존 프로젝트의 llm.service.js 패턴을 따름
 */

import axios from "axios";
import { config } from "../config.js";

const LLM_TIMEOUT_MS = 300000; // 5분 타임아웃 (데이터 생성량이 많을 때 대비)

/**
 * LLM에 텍스트 생성 요청 (OpenAI Chat API)
 * @param {string} prompt - 프롬프트
 * @param {Object} options - 옵션
 * @returns {string} 생성된 텍스트
 */
export const generateText = async (prompt, options = {}) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured in .env file");
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: options.model ?? config.llm.model,
        messages: [
          {
            role: "system",
            content: options.systemPrompt || "You are a helpful assistant.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: options.temperature ?? config.llm.temperature,
        max_tokens: options.maxTokens ?? config.llm.maxTokens,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        timeout: options.timeout ?? LLM_TIMEOUT_MS,
      }
    );

    if (response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    }

    throw new Error("OpenAI API returned no choices");
  } catch (error) {
    if (error.response?.data?.error?.message) {
      throw new Error(`OpenAI API Error: ${error.response.data.error.message}`);
    } else if (error.message) {
      throw new Error(`OpenAI API Error: ${error.message}`);
    } else {
      throw new Error("OpenAI API 호출에 실패했습니다.");
    }
  }
};

/**
 * LLM에 JSON 생성 요청 (파싱 포함)
 * @param {string} prompt - 프롬프트
 * @param {Object} options - 옵션
 * @returns {Object} 파싱된 JSON
 */
export const generateJSON = async (prompt, options = {}) => {
  const text = await generateText(prompt, options);

  // JSON 블록 추출 (```json ... ``` 형태 처리)
  let jsonStr = text;

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    // JSON 배열이나 객체 패턴 찾기
    const objectMatch = text.match(/(\{[\s\S]*\})/);
    const arrayMatch = text.match(/(\[[\s\S]*\])/);

    if (objectMatch) {
      jsonStr = objectMatch[1];
    } else if (arrayMatch) {
      jsonStr = arrayMatch[1];
    }
  }

  // Trailing comma 제거 (JSON에서 허용 안됨)
  jsonStr = jsonStr.replace(/,(\s*[\}\]])/g, '$1');
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("JSON 파싱 실패:", e.message);
    console.error("원본 텍스트 (앞 300자):", text.substring(0, 300));
    console.error("원본 텍스트 (마지막 200자):", text.substring(text.length - 200));
    
    // 불완전한 JSON 복구 시도
    const recoveryStrategies = [
      // 전략 1: 마지막 완전한 배열 요소까지 자르기
      () => {
        // 마지막으로 완전히 닫힌 객체 '}' 뒤에 ',' 또는 ']' 찾기
        const patterns = [/\}\s*,\s*$/m, /\}\s*\]/g, /\]\s*,\s*$/m, /\]\s*\}/g];
        let lastSafePos = -1;
        
        for (const pattern of patterns) {
          let match;
          const testStr = jsonStr;
          pattern.lastIndex = 0;
          while ((match = pattern.exec(testStr)) !== null) {
            if (match.index > lastSafePos) {
              lastSafePos = match.index + match[0].length - 1;
            }
          }
        }
        
        if (lastSafePos > jsonStr.length / 2) {
          let fixedJson = jsonStr.substring(0, lastSafePos + 1);
          
          // Trailing comma 제거
          fixedJson = fixedJson.replace(/,(\s*[\}\]])/g, '$1');
          
          // 닫는 괄호 추가
          const openBraces = (fixedJson.match(/\{/g) || []).length;
          const closeBraces = (fixedJson.match(/\}/g) || []).length;
          const openBrackets = (fixedJson.match(/\[/g) || []).length;
          const closeBrackets = (fixedJson.match(/\]/g) || []).length;
          
          // 순서 중요: ] 먼저, } 나중에
          fixedJson += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
          fixedJson += '}'.repeat(Math.max(0, openBraces - closeBraces));
          
          return JSON.parse(fixedJson);
        }
        return null;
      },
      // 전략 2: 각 최상위 키별로 완전한 부분만 추출
      () => {
        const result = {};
        const keyPattern = /"(business_cards|events|memos|gifts|chats)"\s*:\s*\[/g;
        let match;
        
        while ((match = keyPattern.exec(jsonStr)) !== null) {
          const key = match[1];
          const startIdx = match.index + match[0].length;
          
          // 해당 배열의 끝 찾기
          let depth = 1;
          let endIdx = startIdx;
          for (let i = startIdx; i < jsonStr.length && depth > 0; i++) {
            if (jsonStr[i] === '[') depth++;
            else if (jsonStr[i] === ']') depth--;
            if (depth === 0) endIdx = i;
          }
          
          if (depth === 0) {
            try {
              let arrStr = '[' + jsonStr.substring(startIdx, endIdx) + ']';
              arrStr = arrStr.replace(/,(\s*[\}\]])/g, '$1');  // Trailing comma 제거
              result[key] = JSON.parse(arrStr);
            } catch {}
          } else {
            // 배열이 잘린 경우: 마지막 완전한 객체까지만
            const arrContent = jsonStr.substring(startIdx);
            const lastComplete = arrContent.lastIndexOf('},');
            if (lastComplete > 0) {
              try {
                let arrStr = '[' + arrContent.substring(0, lastComplete + 1) + ']';
                arrStr = arrStr.replace(/,(\s*[\}\]])/g, '$1');  // Trailing comma 제거
                result[key] = JSON.parse(arrStr);
              } catch {}
            }
          }
        }
        
        if (Object.keys(result).length > 0) {
          return result;
        }
        return null;
      }
    ];
    
    for (let i = 0; i < recoveryStrategies.length; i++) {
      try {
        console.log(`JSON 복구 시도 (전략 ${i + 1})...`);
        const recovered = recoveryStrategies[i]();
        if (recovered) {
          console.log(`JSON 복구 성공 (전략 ${i + 1})!`);
          return recovered;
        }
      } catch (recoveryError) {
        console.error(`전략 ${i + 1} 실패:`, recoveryError.message);
      }
    }
    
    throw new Error(`JSON 파싱 실패: ${e.message}`);
  }
};

/**
 * 시나리오 옵션 생성 (사용자가 선택할 수 있는 여러 시나리오 제안)
 * @param {string} domain - 도메인/분야 (예: "비즈니스", "개인", "영업" 등)
 * @returns {Array} 시나리오 옵션 배열
 */
export const generateScenarioOptions = async (domain = "비즈니스") => {
  const prompt = `
당신은 비즈니스 관계 관리 앱의 테스트 시나리오 생성기입니다.
"${domain}" 분야에 대해 5개의 다양한 시나리오 옵션을 생성해주세요.

**중요**: 
- "나" (사용자/주인공)에 대한 정보는 생성하지 마세요.
- **명함 수는 정확히 1명만!** (대신 그 1명에 대해 풍부한 데이터가 생성됨)
- 그 1명에 대한 정보를 매우 상세하게 작성

각 시나리오는 다음을 포함해야 합니다:
1. **정확히 1명**의 관계 인물 (이름, 직책, 회사)
2. 각 인물의 **상세한 특징** (선호 2개 이상, 비선호/알레르기, 기념일 2개 이상)
3. **다양한 만남 유형** (미팅, 식사, 통화, 행사 등)
4. **다양한 선물 상황** (감사, 생일, 명절 등)

**⚠️ 5개 시나리오의 관계 깊이를 다양하게!**
- 1-2개: 밀접한 관계 (만남 많음, 개인정보 공유)
- 2-3개: 보통 관계 (정기적 업무 만남)
- 1개: 형식적 관계 (명함 교환 후 가끔 연락)

## 출력 형식
반드시 아래 JSON 배열 형식으로만 출력하세요 (시나리오당 1명만!):

\`\`\`json
[
  {
    "id": 1,
    "title": "투자 유치 관계 관리 - 박서연 VC 심사역",
    "description": "블루벤처스 VC 심사역과의 장기적 투자 관계 구축",
    "contacts": [
      {
        "name": "박서연",
        "position": "VC 심사역",
        "company": "블루벤처스",
        "gender": "여성",
        "traits": [
          "커피 좋아함 (아메리카노 선호)", 
          "골프 즐김",
          "견과류 알레르기 - 주의!",
          "생일 5월 15일",
          "결혼기념일 11월 20일",
          "아침형 인간, 오전 미팅 선호",
          "아들이 초등학생",
          "와인 수집 취미"
        ],
        "interactions": [
          "초기 투자 피칭 미팅",
          "포트폴리오 상세 소개", 
          "점심 식사 (한정식)",
          "기술 데모 시연",
          "분기별 성과 리뷰",
          "네트워킹 행사 동행",
          "커피 미팅",
          "전화 통화"
        ],
        "gifts": [
          "첫 미팅 감사 - 프리미엄 커피세트",
          "생일 선물 - 골프장갑",
          "아들 생일 - 레고세트",
          "명절 - 한우세트 (견과류 제외)",
          "프로젝트 완료 감사 - 고급 와인",
          "결혼기념일 - 꽃다발"
        ]
      }
    ],
    "preview": "장기적 투자 관계를 쌓아가는 상세한 시나리오"
  }
]
\`\`\`

5개의 시나리오를 생성해주세요. 각 시나리오당 2~3명의 인물로 제한하되, 상세하게 작성하세요.
`;

  return await generateJSON(prompt, { 
    temperature: 0.9, 
    maxTokens: 4000,
    systemPrompt: "You are a scenario generator that creates realistic business relationship scenarios. Always respond with valid JSON arrays only. Do NOT include protagonist/user information."
  });
};

/**
 * 시나리오 기반 더미 데이터 생성
 * @param {string} scenario - 자연어 시나리오 텍스트
 * @returns {Object} 생성된 원본 테이블 데이터
 */
export const generateDummyData = async (scenario) => {
  const prompt = `
당신은 데이터베이스 테스트 데이터 생성기입니다.
다음 시나리오를 읽고, MySQL 데이터베이스에 삽입할 수 있는 JSON 형식의 데이터를 생성해주세요.

## 시나리오
${scenario}

## 중요: user_id는 항상 1로 고정
- 새 사용자를 생성하지 않습니다.
- 모든 데이터는 기존 user_id = 1 계정에 추가됩니다.
- users 테이블 데이터는 생성하지 마세요.

## ⚠️ 관계 그래프 최적화 핵심 원칙 ⚠️
**이 데이터는 관계형 동적 그래프를 생성하는 데 사용됩니다!**
**모든 명함이 같은 "거리(친밀도)"를 가지면 안 됩니다!**

관계 깊이(그래프 거리)를 결정하는 요소:
1. **상호작용 빈도**: 일정 수가 많을수록 가까운 관계
2. **상호작용 깊이**: 공식미팅 → 비공식식사 → 개인적만남 순으로 깊어짐
3. **메모 상세함**: 개인 정보(가족, 취미)를 알수록 친밀한 관계
4. **선물 빈도/가치**: 선물이 많을수록 중요한 관계
5. **시간적 지속성**: 오래 유지된 관계가 더 깊음

**⚠️ 실제 데이터처럼 자연스러운 관계 다양성 필수!**

실제 비즈니스 관계는 **파레토 법칙**을 따릅니다:
- **80%**: 형식적/보통 관계 (일정 2-3개, 간단한 업무 메모)
- **15%**: 친밀한 관계 (일정 4-5개, 상세 메모)
- **5%**: 밀접한 관계 (일정 5개+, 개인정보 포함 메모, 선물)

**관계 깊이는 데이터 자체로 표현하세요 (메타데이터 NO!):**
| 관계 깊이 | 데이터로 어떻게 표현? |
|----------|---------------------|
| 밀접함 | 일정 많음 + 메모에 가족/취미 언급 + 비공식 만남(식사,커피) + 선물 있음 |
| 보통 | 일정 적당 + 업무 메모만 + 공식 미팅 위주 |
| 형식적 | 일정 적음 + 간단 메모 + 첫 미팅 후 후속 없음 |

**⚠️ 노골적인 메타데이터(relationship_strength 등)는 절대 생성하지 마세요!**
실제 사용자가 남기지 않을 데이터는 생성하면 안 됩니다.

## 생성할 테이블 스키마 (중요: 각 컬럼 형식을 정확히 따르세요)

### 1. business_cards (명함 - 관계 인물들)
- id: INT (자동생성, 생략 가능)
- userId: INT - users.id 참조
- name: VARCHAR(100) - 인물 이름
- position: VARCHAR(100) - 직책
- company: VARCHAR(200) - 회사명
- phone: VARCHAR(50) - 연락처
- email: VARCHAR(255) - 이메일
- memo: TEXT - 짧은 메모 (명함에 적는 간단한 메모)
- image: TEXT - null 가능
- design: VARCHAR(50) - 명함 디자인 테마 ("default", "modern", "classic", "minimal" 중 택1)
- isFavorite: BOOLEAN - 즐겨찾기 여부 (true/false)
- gender: VARCHAR(10) - 성별 ("남성", "여성")
- createdAt: DATETIME - 명함 등록 시간 (자동 할당, 생성 금지)

### 3. events (일정/미팅) ⚠️ 관계 그래프 핵심 데이터! ⚠️
**🔗 이 일정 데이터는 "누가-언제-어떤 맥락에서" 만났는지를 나타내는 관계 그래프의 핵심입니다!**

- id: INT (자동생성, 생략 가능)
- userId: INT - users.id 참조
- title: VARCHAR(200) - 일정 제목 **⚠️ 관계의 맥락을 명확히 표현!**
- startDate: DATETIME - 시작 시간 (자동 할당, 생성 금지)
- endDate: DATETIME - 종료 시간 (자동 할당, 생성 금지)
- category: VARCHAR(50) - 반드시 다음 중 하나: "미팅", "식사", "출장", "통화", "기타"
- description: TEXT - 상세 설명 **⚠️ 만남의 목적, 논의 내용, 결과를 구체적으로!**
- location: VARCHAR(255) - 장소 **⚠️ 정확한 장소명 (회사명, 카페명 등)**
- participants: TEXT - 참여자 이름 **⚠️ 단순 문자열로! 예: "박서연", "김철수, 이영희" (배열 금지!)**
- memo: TEXT - 일정 메모 **⚠️ 관계 진전도, 다음 액션 아이템 등**
- notification: INT - 알림 시간 (분 단위, 예: 30)
- isAllDay: BOOLEAN - 종일 일정 여부
- linked_card_ids: VARCHAR(255) - 연결된 명함 ID들 (콤마 구분, 예: "1,2,3") **⚠️ 관계 그래프 연결 필수!**
- color: VARCHAR(20) - 색상 코드 (예: "#4285F4")
- createdAt: DATETIME - 등록 시간 (자동 할당, 생성 금지)

**🎯 관계 그래프 최적화 일정 생성 규칙:**
1. **단계적 관계 발전**: 첫 미팅 → 업무 미팅 → 식사 → 비공식 만남 등 자연스러운 순서
2. **구체적인 맥락**: "투자 유치 1차 미팅", "계약서 검토 회의", "프로젝트 킥오프" 등
3. **관계 깊이 표현**: 초기엔 공식적, 점차 비공식적 만남으로 발전
4. **명함 연결 필수**: linked_card_ids로 어떤 명함과 연관된 일정인지 명확히!

### 4. gifts (선물 이력)
- id: INT (자동생성, 생략 가능)
- userId: INT - users.id 참조
- cardId: INT - business_cards.id 참조 (누구에게 줬는지)
- giftName: VARCHAR(200) - 선물명
- giftDescription: TEXT - 선물 설명
- giftImage: TEXT - null 가능
- price: INT - 가격 (숫자만)
- category: VARCHAR(100) - 선물 카테고리
- purchaseDate: DATETIME - 구매/전달 날짜
- occasion: VARCHAR(100) - 상황 (예: "생일", "승진축하", "감사", "명절", "크리스마스")
- notes: TEXT - 추가 메모
- year: INT - 연도 (예: 2025)
- createdAt: DATETIME - 등록 시간 (자동 할당, 생성 금지)

### 5. chats (선물 추천 대화)
- id: INT (자동생성, 생략 가능)
- userId: INT - users.id 참조
- llmProvider: VARCHAR(50) - "gpt" 고정
- title: VARCHAR(200) - 대화 제목
- messages: JSON - 대화 메시지 배열 (아래 형식 참조)
- isActive: BOOLEAN - 활성 여부
- createdAt: DATETIME - 대화 시작 시간

#### chats.messages 형식 (중요! - 사용자의 자연스러운 질문이 먼저 나와야 함):
[
  {"role": "user", "content": "부장님 아들 생일인데 선물 추천해줘. 부장님이 커피 좋아하시고 견과류 알레르기 있으셔"},
  {"role": "assistant", "content": "다음은 상대방 정보입니다.\\n이름: 박서연\\n특징: 커피 좋아함, 견과류 알레르기\\n\\n추가 정보: 가족(아들) 생일 선물 추천"},
  {"role": "assistant", "content": "추천 선물 목록:\\n1. 레고 스타워즈 세트 (89,000원)\\n2. 닌텐도 게임 카드 (55,000원)\\n3. 스포츠 용품 세트 (65,000원)"},
  {"role": "user", "content": "선택한 선물: 레고 스타워즈 세트"},
  {"role": "assistant", "content": "선물이 저장되었습니다!"}
]

**사용자 질문 예시** (자연스러운 구어체로!):
- "김과장님 승진했는데 뭐 선물하면 좋을까?"
- "거래처 사장님 명절 선물 추천 좀"
- "팀장님 결혼기념일인데 와이프분께 드릴 선물 뭐가 좋아?"
- "부장님 아들이 대학 합격했대. 축하 선물 뭐가 좋을까?"
- "협력사 담당자분 이번에 출산하셨는데 선물 추천해줘"
- "첫 미팅 감사 선물로 뭐가 좋을까? 커피 좋아하신다고 했어"

### 6. memo (상세 메모 - 미팅 후 회고)
- id: INT (자동생성, 생략 가능)
- user_id: INT - users.id 참조
- business_card_id: INT - business_cards.id 참조
- content: TEXT - 상세 메모 내용 (미팅 후 관찰, 인상, 향후 계획 등)
- created_at: DATETIME - 작성 시간 (자동 할당, 생성 금지)
- updated_at: DATETIME - 수정 시간 (자동 할당, 생성 금지)

## ⚠️⚠️⚠️ 매우 중요: 데이터 양 규칙 (반드시 준수!) ⚠️⚠️⚠️
**명함 수는 정확히 1명만! 하지만 그 1명에 대해 풍부한 데이터를 생성!**

### 명함 1명에 대해 생성할 데이터 (절대 빠짐없이!):
### 🔗 생성할 데이터 수량 (시나리오의 관계 깊이에 맞게 자연스럽게 조절)

| 데이터 종류 | 수량 | 설명 |
|------------|-----|------|
| **메모(memo)** | 5-6개 | 시나리오에 맞게 조절. 밀접한 관계면 개인정보 포함 |
| **일정(events)** | 5-6개 | 관계 발전 과정 표현. 첫 미팅→업무→식사 등 |
| **선물(gifts)** | 0-1개 | 친밀한 관계면 포함, 형식적이면 생략 |
| **채팅(chats)** | 0-1개 | 선물이 있을 때만 포함 |

**⚠️ 시나리오의 만남(interactions) 수를 참고해서 적절히 조절하세요!**
**⚠️ 모든 데이터가 똑같은 수량이면 안 됩니다!**

**채팅은 반드시 사용자의 자연스러운 질문으로 시작!** 예:
- "부장님 아들 생일인데 뭐 사면 좋을까?"
- "거래처 사장님 명절 선물 추천 좀"

**✅ 내용 생성 체크리스트:**
✅ 모든 데이터의 내용이 서로 다른가?
✅ 현실적이고 구체적인 내용인가?  
✅ 시간 필드는 생략했는가?
✅ 필수 필드(제목, 설명, 카테고리 등)는 포함했는가?

## 중요 생성 규칙
1. **풍부한 데이터 생성**: 위 최소 수량을 반드시 지켜주세요. 실제 비즈니스 관계처럼 오랜 기간 쌓인 데이터를 시뮬레이션합니다.

2. **시간 데이터는 자동 할당**: 시간 관련 필드는 생략하고 내용만 생성하세요. 
   - 시간/날짜는 알고리즘이 자동으로 중복 없이 현실적으로 할당합니다.
   - **생성하지 마세요**: createdAt, startDate, endDate, purchaseDate, created_at, updated_at
3. **현실적이고 다양한 메모**: 각 메모는 서로 다른 상황과 내용이어야 합니다:
   - "커피를 좋아하신다고 하셨음. 아메리카노 선호."
   - "오전 미팅을 선호하시는 편. 10시 이후로 잡기."
   - "견과류 알레르기 있음 - 선물 선택 시 주의!"
   - "다음 미팅에서 기술 데모 요청하심. PPT 준비 필요."
   - "점심 식사 중 가족 이야기. 아들이 초등학생."
   - "최근 골프에 관심 많으심. 주말에 라운딩 자주 하신다고."
4. **events.category는 반드시** "미팅", "식사", "출장", "통화", "기타" 중 하나.
5. **gifts.occasion은 다양하게**: "생일", "승진축하", "감사", "명절", "크리스마스", "프로젝트완료" 등.
6. **chats.messages**는 "추가 정보:" 문구 포함. 각 채팅은 다른 상황(생일선물, 감사선물 등).

## ⚠️ 매우 중요: 시나리오의 인물 정보를 반드시 사용하세요! ⚠️
**위 시나리오에 나온 이름, 직책, 회사, 특성을 정확히 사용해야 합니다!**
**예시의 인물(박서연 등)을 사용하지 마세요! 시나리오의 인물만 사용하세요!**

## 출력 형식
아래는 JSON 구조 예시입니다. **값은 반드시 시나리오의 인물 정보로 대체하세요!**

\`\`\`json
{
  "business_cards": [
    {
      "name": "<시나리오의 인물 이름>",
      "position": "<시나리오의 직책>",
      "company": "<시나리오의 회사명>",
      "phone": "010-XXXX-XXXX",
      "email": "<적절한 이메일>",
      "memo": "<시나리오에 나온 특성들을 요약>",
      "image": null,
      "design": "modern",
      "isFavorite": true,
      "gender": "<시나리오의 성별>"
    }
  ],
  "events": [
    {
      "title": "<시나리오 맥락에 맞는 미팅 제목>",
      "category": "미팅",
      "description": "<구체적 설명>",
      "location": "<구체적 장소>",
      "participants": "<시나리오의 인물 이름>",
      "memo": "<미팅 관련 메모>",
      "notification": 30,
      "isAllDay": false,
      "linked_card_ids": "1",
      "color": "#4285F4"
    }
  ],
  "gifts": [
    {
      "cardId": 1,
      "giftName": "<시나리오 인물의 특성에 맞는 선물>",
      "giftDescription": "<선물 설명>",
      "giftImage": null,
      "price": 45000,
      "category": "식품",
      "occasion": "감사",
      "notes": "<선물 선택 이유>",
      "year": 2025
    }
  ],
  "chats": [
    {
      "llmProvider": "gpt",
      "title": "<시나리오 인물 이름>님 선물 추천",
      "messages": [
        {"role": "user", "content": "<인물 이름>님한테 선물 뭐가 좋을까? <특성> 좋아하신다고 했어"},
        {"role": "assistant", "content": "다음은 상대방 정보입니다.\\n이름: <인물이름>\\n직책: <직책>\\n회사: <회사>\\n특징: <특성들>\\n\\n추가 정보: 감사 선물 추천"},
        {"role": "assistant", "content": "추천 선물 목록:\\n1. <선물1>\\n2. <선물2>\\n3. <선물3>"},
        {"role": "user", "content": "선택한 선물: <선물1>"},
        {"role": "assistant", "content": "선물이 저장되었습니다!"}
      ],
      "isActive": false
    }
  ],
  "memo": [
    {
      "business_card_id": 1,
      "content": "<시나리오 맥락에 맞는 구체적인 메모 내용. 인물의 특성, 미팅 내용 등 반영>"
    }
  ]
}
\`\`\`

**⚠️ 절대 주의사항**: 
- **시나리오에 나온 정확한 인물 정보(이름, 직책, 회사, 특성)를 사용하세요!**
- **예시 값(박서연, 블루벤처스 등)을 그대로 사용하면 안 됩니다!**
- business_cards, events, gifts, chats, memo에서 userId, user_id는 생략 (서버에서 자동 설정).
- cardId, business_card_id는 1부터 시작 (첫 번째 명함 = 1).
- JSON만 출력하고 다른 설명은 포함하지 마세요.
`;

  return await generateJSON(prompt, { 
    temperature: 0.7, 
    maxTokens: 16000,  // 적절한 토큰 수
    systemPrompt: "You are a database test data generator. Generate realistic, coherent data based on scenarios. IMPORTANT: Generate data according to the relationship depth specified. Always respond with COMPLETE valid JSON only. No explanations, no markdown. If response might be long, prioritize completing the JSON structure."
  });
};

/**
 * source_event에서 fact 추출 (기존 fact 컨텍스트 포함)
 * @param {Object} sourceEvent - source_event 레코드
 * @param {Array} existingFacts - 해당 card_id의 기존 fact 목록 (optional)
 * @returns {Array} 추출된 fact 배열
 */
export const extractFacts = async (sourceEvent, existingFacts = []) => {
  // 기존 fact 컨텍스트 생성
  let existingFactsContext = '';
  if (existingFacts && existingFacts.length > 0) {
    existingFactsContext = `
## ⚠️ 기존에 알려진 Fact (이 사람에 대해 이미 파악된 정보)
아래는 이 사람에 대해 **이전에 추출된 fact**입니다.
새 정보가 기존 fact와 **충돌하거나 변경**되면 반드시 반영하세요.

${existingFacts.map(f => `- [${f.fact_type}] ${f.fact_key} (polarity: ${f.polarity}, confidence: ${f.confidence})`).join('\n')}

### 기존 Fact 처리 규칙:
1. **강화**: 새 정보가 기존 fact를 뒷받침하면 → 같은 fact_key, confidence 유지/상승
2. **변경**: 취향/상황이 바뀌었으면 → 새 fact 추출 (예: "요즘은 차를 더 좋아함")
3. **모순**: 기존과 반대되는 정보면 → action="INVALIDATE"로 표시하고 새 fact 추출
`;
  }

  const prompt = `
당신은 비정형 텍스트에서 구조화된 사실(fact)을 추출하는 전문가입니다.
${existingFactsContext}
## 새 입력 데이터
- source_type: ${sourceEvent.source_type}
- 발생일: ${sourceEvent.occurred_at}
- 원본 텍스트:
${sourceEvent.raw_text}

## 추출할 fact_type (8가지 고정)
1. PREFERENCE - 선호하는 것 (좋아하는 것, 관심사)
2. DISLIKE - 싫어하는 것, 피하는 것
3. RISK - 리스크 요소 (알레르기, 건강 문제 등)
4. CONSTRAINT - 제약 조건 (시간, 장소, 방식 제한 등)
5. DATE - 중요한 날짜 (생일, 기념일 등)
6. ROLE_OR_ORG - 역할, 직책, 소속 조직 정보
7. INTERACTION - 상호작용 기록 (미팅, 통화, 이벤트 등)
8. CONTEXT - 기타 맥락 정보 (성격, 특성, 배경 등)

## 추출 규칙
1. **명시적으로 언급된 것만** 추출 (추론/추측 금지)
2. 각 fact에는 반드시 원본 텍스트에서 추출한 **evidence** 포함
3. **confidence**는 0.0 ~ 1.0 (명시적일수록 높게)
   - 1.0: 직접적으로 언급됨 ("커피를 좋아한다")
   - 0.8: 강하게 암시됨
   - 0.5: 약하게 암시됨
4. **fact_key**는 구체적으로 작성 (예: "coffee", "morning_meeting", "nut_allergy")
5. 민감한 정보(정치, 종교, 건강상세)는 추출하지 않음
6. **action** 필드 (optional):
   - "INVALIDATE": 기존 fact가 더 이상 유효하지 않음 (invalidate_key로 무효화할 fact_key 지정)

## 출력 형식
JSON 배열로 출력하세요:

\`\`\`json
[
  {
    "fact_type": "PREFERENCE",
    "fact_key": "coffee",
    "polarity": 1,
    "confidence": 0.9,
    "evidence": "커피를 좋아하신다고 하셨음"
  },
  {
    "fact_type": "DISLIKE",
    "fact_key": "seafood",
    "polarity": -1,
    "confidence": 0.8,
    "evidence": "해산물은 싫어하신다고 함"
  },
  {
    "fact_type": "DATE",
    "fact_key": "birthday",
    "polarity": 0,
    "confidence": 1.0,
    "evidence": "생일은 5월 15일"
  }
]
\`\`\`

### polarity 값 규칙:
- **+1 (긍정/선호)**: PREFERENCE에 해당하는 긍정적 사실
- **-1 (부정/위험)**: DISLIKE, RISK에 해당하는 부정적/위험 사실
- **0 (중립/정보)**: DATE, ROLE_OR_ORG, INTERACTION, CONTEXT, CONSTRAINT

텍스트에서 추출 가능한 모든 fact를 추출해주세요. 추출할 fact가 없으면 빈 배열 []을 반환하세요.
`;

  return await generateJSON(prompt, { 
    temperature: 0.1, 
    maxTokens: 2000,
    systemPrompt: "You are a fact extraction system. Extract facts while considering existing context. Handle conflicts by marking invalidations. Return only valid JSON arrays."
  });
};

/**
 * 기존 명함에 대해 추가 데이터 생성
 * @param {Object} card - 기존 명함 정보
 * @param {Object} existingData - 이미 존재하는 데이터 (중복 방지용)
 * @returns {Object} 생성된 메모, 일정, 선물, 채팅 데이터
 */
export const generateDataForExistingCard = async (card, existingData = {}) => {
  // 기존 데이터 문자열 생성
  const existingMemosStr = (existingData.memos || []).length > 0 
    ? existingData.memos.map((m, i) => `  ${i + 1}. ${m}`).join('\n')
    : '  (없음)';
  const existingEventsStr = (existingData.events || []).length > 0
    ? existingData.events.map((e, i) => `  ${i + 1}. ${e}`).join('\n')
    : '  (없음)';
  const existingGiftsStr = (existingData.gifts || []).length > 0
    ? existingData.gifts.map((g, i) => `  ${i + 1}. ${g}`).join('\n')
    : '  (없음)';
  const existingChatsStr = (existingData.chats || []).length > 0
    ? existingData.chats.map((c, i) => `  ${i + 1}. ${c}`).join('\n')
    : '  (없음)';

  const prompt = `
당신은 비즈니스 관계 관리 데이터 생성기입니다.
기존 명함(관계 인물)에 대해 **새로운** 추가 데이터를 생성해주세요.

## 기존 명함 정보
- 이름: ${card.name}
- 직책: ${card.position || '미입력'}
- 회사: ${card.company || '미입력'}
- 성별: ${card.gender || '미입력'}
- 기존 메모: ${card.memo || '없음'}

## ⚠️⚠️ 중복 방지 - 매우 중요!! ⚠️⚠️
아래는 이미 이 명함에 대해 존재하는 데이터입니다.
**절대로 비슷하거나 중복된 내용을 생성하지 마세요!**
**완전히 새로운 내용만 생성해야 합니다!**

### 이미 존재하는 메모 (중복 금지):
${existingMemosStr}

### 이미 존재하는 일정 (중복 금지):
${existingEventsStr}

### 이미 존재하는 선물 (중복 금지):
${existingGiftsStr}

### 이미 존재하는 채팅 (중복 금지):
${existingChatsStr}

## ⚠️ 생성 규칙 (반드시 준수!)
위 기존 데이터와 **중복 없이 새롭게** 생성:
- **memos: 5-6개** - 기존과 다른 새로운 관찰, 인상, 메모
- **events: 5-6개** - 기존과 다른 새로운 미팅, 식사, 통화 등

**⚠️ JSON 완성을 최우선으로! 데이터가 잘리지 않도록 적당한 양만 생성!**
- **gifts: 정확히 1개** - 기존과 다른 새로운 상황의 선물
- **chats: 정확히 1개** - 기존과 다른 새로운 선물 추천 대화

**⚠️ 시간 필드는 생성하지 마세요!**
모든 시간 관련 필드(created_at, updated_at, startDate, endDate, purchaseDate, createdAt)는 
알고리즘이 자동으로 중복 없이 현실적으로 할당합니다.

## ⚠️ 시간 규칙 (매우 중요! 중복 절대 금지!)
- **전체 기간**: 2025년 9월부터 2026년 1월까지
- **중복 방지**: 기존 데이터와 절대로 같은 날짜/시간 사용 금지!
- **최소 간격 규칙**: 
  * 일정들: 최소 3일 이상 간격 (예: 기존에 1/15가 있으면 새로운 일정은 1/19 이후)
  * 메모들: 각각 다른 날짜 (예: 1/20, 2/5, 2/18, 3/2, ...)
  * 시간대도 다양화: 09:30, 14:15, 16:45, 19:20 등 (정시 피하기)
- **현실적 순서**: 기존 데이터 이후 시간부터 생성
- **요일/시간 분산**: 월~금 다양한 시간, 가끔 토요일
- **시간순 정렬**: 생성된 데이터를 날짜순으로 정렬해서 출력

## 출력 형식
\`\`\`json
{
  "memos": [
    {
      "content": "첫 미팅에서 커피를 좋아하신다고 하셨음. 아메리카노 선호.",
      // created_at, updated_at은 자동 할당됨
    }
  ],
  "events": [
    {
      "title": "첫 미팅",
      // startDate, endDate는 자동 할당됨
      "category": "미팅",
      "description": "첫 만남 및 소개",
      "location": "본사 회의실",
      "participants": "${card.name}",
      "memo": "명함 교환",
      "notification": 30,
      "isAllDay": false,
      "color": "#4285F4"
    }
  ],
  "gifts": [
    {
      "giftName": "프리미엄 커피세트",
      "giftDescription": "고급 원두 선물세트",
      "price": 45000,
      "category": "식품",
      // purchaseDate는 자동 할당됨
      "occasion": "감사",
      "notes": "첫 미팅 감사 선물",
      "year": 2024
    }
  ],
  "chats": [
    {
      "title": "${card.name}님 감사 선물 추천",
      "messages": [
        {"role": "user", "content": "${card.name}님한테 첫 미팅 감사 선물 뭐가 좋을까?"},
        {"role": "assistant", "content": "다음은 상대방 정보입니다.\\n이름: ${card.name}\\n\\n추가 정보: 감사 선물 추천"},
        {"role": "assistant", "content": "추천 선물:\\n1. 프리미엄 커피세트\\n2. 고급 차세트"},
        {"role": "user", "content": "선택한 선물: 프리미엄 커피세트"},
        {"role": "assistant", "content": "선물이 저장되었습니다!"}
      ],
      "isActive": false,
      // createdAt은 자동 할당됨
    }
  ]
}
\`\`\`

**중요**: 
- 각 카테고리 정확히 6개씩
- events.category는 "미팅", "식사", "출장", "통화", "기타" 중 하나
- gifts.occasion은 "생일", "승진축하", "감사", "명절", "크리스마스", "프로젝트완료" 등 다양하게
- **채팅은 반드시 user의 자연스러운 질문으로 시작!** 예:
  - "${card.name}님 생일 선물 추천해줘"
  - "${card.name}님 아들이 대학 합격했대 축하 선물 뭐가 좋을까?"
  - "이번에 ${card.name}님한테 명절 선물 보내야 하는데 뭐가 좋아?"
  - "${card.name}님 승진하셨는데 뭐 보내면 좋을까"
- 기존 명함 메모(${card.memo || '없음'})를 참고해서 현실적인 데이터 생성
`;

  return await generateJSON(prompt, { 
    temperature: 0.7, 
    maxTokens: 6000,
    systemPrompt: "You are a business relationship data generator. Generate exactly 6 items for each category. Always respond with valid JSON only."
  });
};

// 초기화 함수 (호환성 유지)
export const initLLM = () => {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠️ OPENAI_API_KEY not found in environment variables");
    return false;
  }
  console.log("✓ LLM Client initialized (OpenAI API)");
  return true;
};
