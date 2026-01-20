import express from "express";
import ExtractedFact from "../models/ExtractedFact.model.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { processLLMChat } from "../services/llm.service.js";

const router = express.Router();

router.use(authenticate);

const clampScore = (value) => Math.max(0, Math.min(10, value));
const toScore = (value) => Number(clampScore(value).toFixed(1));

const summarizeFactsFallback = (facts = []) => {
  const byType = facts.reduce((acc, fact) => {
    const type = fact.fact_type || fact.factType;
    if (!type) return acc;
    if (!acc[type]) acc[type] = [];
    acc[type].push(fact);
    return acc;
  }, {});

  const total = facts.length;
  const count = (type) => (byType[type] ? byType[type].length : 0);

  const roleOrg = count("ROLE_OR_ORG");
  const interaction = count("INTERACTION");
  const preference = count("PREFERENCE");
  const dislike = count("DISLIKE");
  const risk = count("RISK");
  const constraint = count("CONSTRAINT");
  const context = count("CONTEXT");

  const roleKeywords = ["대표", "임원", "CEO", "CTO", "CFO", "심사역", "VC", "투자"];
  const hasDecisionRole = facts.some((fact) => {
    const key = String(fact.fact_key || "");
    return roleKeywords.some((kw) => key.includes(kw));
  });

  const snapshot = {
    relationshipDensity: toScore(2 + total * 0.6),
    businessRelevance: toScore(2 + roleOrg * 1.4 + interaction * 0.6 + constraint * 0.4),
    personalAffinity: toScore(2 + preference * 0.8 + context * 0.6 + interaction * 0.4),
    decisionInfluence: toScore((hasDecisionRole ? 6 : 3) + roleOrg * 1.1 + interaction * 0.4),
    growthPotential: toScore(3 + interaction * 0.6 + context * 0.4 + (preference > 0 ? 0.6 : 0)),
  };

  const pickKeys = (type, limit = 2) =>
    (byType[type] || [])
      .map((fact) => fact.fact_key)
      .filter(Boolean)
      .slice(0, limit);

  const roleKeys = pickKeys("ROLE_OR_ORG", 2);
  const interactionKeys = pickKeys("INTERACTION", 2);
  const contextKeys = pickKeys("CONTEXT", 2);
  const preferenceKeys = pickKeys("PREFERENCE", 2);
  const dislikeKeys = pickKeys("DISLIKE", 2);
  const riskKeys = pickKeys("RISK", 2);

  const sentences = [];
  if (roleKeys.length > 0) {
    sentences.push(`상대는 ${roleKeys.join(", ")} 관련 정보가 확인됩니다.`);
  }
  if (interactionKeys.length > 0) {
    sentences.push(`주요 상호작용은 ${interactionKeys.join(", ")}로 요약됩니다.`);
  }
  if (contextKeys.length > 0) {
    sentences.push(`맥락 정보로는 ${contextKeys.join(", ")}가 있습니다.`);
  }
  if (preferenceKeys.length > 0 || dislikeKeys.length > 0 || riskKeys.length > 0) {
    const personal = [
      preferenceKeys.length ? `선호: ${preferenceKeys.join(", ")}` : null,
      dislikeKeys.length ? `비선호: ${dislikeKeys.join(", ")}` : null,
      riskKeys.length ? `주의: ${riskKeys.join(", ")}` : null,
    ].filter(Boolean);
    sentences.push(`개인적 특성은 ${personal.join(" / ")}로 파악됩니다.`);
  }

  if (sentences.length === 0) {
    sentences.push("추출된 관계 정보가 제한적입니다.");
  }

  return {
    snapshot,
    narrative: sentences.join(" "),
  };
};

const buildLLMPrompt = (facts = []) => {
  const factLines = facts.map((fact, index) => {
    const type = fact.fact_type || fact.factType || "UNKNOWN";
    const key = fact.fact_key || fact.factKey || "";
    const evidence = (fact.evidence || "").replace(/\s+/g, " ").slice(0, 200);
    return `${index + 1}. ${type} | ${key} | evidence: ${evidence}`;
  });

  return `다음은 상대와의 관계를 요약하기 위한 fact 목록입니다.
fact_type, fact_key, evidence를 모두 고려해 더 정교하고 개인화된 요약을 작성하세요.

[요구 사항]
1) 상대 "개인만의 특징"을 1~2개 반드시 강조합니다.
2) "우리 관계에서만 드러나는 특성/에피소드"를 1~2개 강조합니다.
3) 근거 없는 일반론은 금지합니다. 반드시 fact/evidence에 기반합니다.
4) 문체는 간결하고 정돈된 한국어로 작성합니다.
5) 아래 출력 형식을 반드시 지킵니다. 각 레이어는 2~4개의 불릿으로 작성합니다.
6) **'관계로 이어진 맥락' 섹션은 만남/관계의 시작 맥락을 우선 사용합니다.**
   - INTERACTION fact_type 중 first_meeting, 첫 미팅, 소개, 네트워크/그룹 모임 등의 fact_key/evidence를 최우선 반영합니다.
   - 취미나 관심사는 이 섹션에 넣지 않습니다.

[출력 형식]
관계로 이어진 맥락
- ...
- ...

함께 한 것 / 상호작용
- ...
- ...

취미·일상 공유
- ...
- ...

가치·생활 공감
- ...
- ...

키워드 요약
관계로 이어진 맥락
- ...
- ...

함께 한 것 / 상호작용
- ...
- ...

취미·일상 공유
- ...
- ...

가치·생활 공감
- ...
- ...

[facts]
${factLines.join("\n")}
`;
};

// @route   GET /api/relationship-summary
// @desc    Build relationship summary from extracted_fact (LLM if available)
// @access  Private
router.get("/", async (req, res) => {
  try {
    const { cardId } = req.query;
    if (!cardId) {
      return res.status(400).json({
        success: false,
        message: "cardId is required",
      });
    }

    const facts = await ExtractedFact.findByUserIdAndCardId(req.user.id, cardId);

    if (!facts.length) {
      return res.json({
        success: true,
        data: {
          snapshot: {
            relationshipDensity: 0,
            businessRelevance: 0,
            personalAffinity: 0,
            decisionInfluence: 0,
            growthPotential: 0,
          },
          narrative: "추출된 관계 정보가 없습니다.",
          source: "empty",
        },
      });
    }

    let summary;
    try {
      const system = "당신은 비즈니스 관계 요약 전문가입니다. 요청된 형식을 반드시 지키고 사실 기반으로만 작성하세요.";
      const user = buildLLMPrompt(facts);
      const llmResponse = await processLLMChat(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        "gpt"
      );

      summary = {
        llmText: llmResponse,
        source: "llm",
      };
    } catch (error) {
      summary = null;
    }

    if (!summary || !summary.llmText || summary.llmText.includes("mock response")) {
      const fallback = summarizeFactsFallback(facts);
      return res.json({
        success: true,
        data: {
          ...fallback,
          source: "fallback",
        },
      });
    }

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;

