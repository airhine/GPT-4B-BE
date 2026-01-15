import axios from "axios";
import { BaseProvider } from "./base.provider.js";
import { logger } from "../../../utils/logger.js";

/**
 * Google Gemini Provider (via Luxia API)
 */
export class GeminiProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    // Luxia API를 통한 Gemini 사용
    this.baseURL = "https://bridge.luxiacloud.com/llm/google/gemini/generate/flash20/content";
  }

  /**
   * Format messages for Gemini API (Luxia format)
   * Luxia Gemini API는 단순한 텍스트 입력을 받음
   */
  formatMessages(messages) {
    // 마지막 사용자 메시지를 찾아서 contents로 변환
    // 또는 전체 대화를 하나의 텍스트로 변환
    const lastUserMessage = messages.filter(m => m.role === "user").pop();
    if (lastUserMessage) {
      return lastUserMessage.content;
    }
    
    // 사용자 메시지가 없으면 전체 메시지를 텍스트로 변환
    return messages.map(m => `${m.role}: ${m.content}`).join("\n");
  }

  /**
   * Chat completion
   */
  async chat(messages, options = {}) {
    if (!this.isAvailable()) {
      throw new Error("Conference_API_KEY is not configured for Gemini");
    }

    const contents = this.formatMessages(messages);

    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: "gemini-2.0-flash",
          contents: contents,
        },
        {
          headers: {
            "Content-Type": "application/json",
            apikey: this.apiKey,
          },
          timeout: this.timeout,
        }
      );

      return this.parseResponse(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate embedding
   * Note: Gemini API doesn't have a direct embedding endpoint
   * This would need to use a different service or fallback
   */
  async embed(text, options = {}) {
    throw new Error("Gemini provider does not support embedding. Use LuxiaGPT provider for embeddings.");
  }

  /**
   * Parse response from Gemini API (Luxia format)
   */
  parseResponse(response) {
    // Luxia Gemini API 응답 형식
    if (response.results && response.results.length > 0) {
      const firstResult = response.results[0];
      if (firstResult.candidates && firstResult.candidates.length > 0) {
        const candidate = firstResult.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          return candidate.content.parts[0].text;
        }
      }
    }
    throw new Error("Gemini API returned no candidates");
  }

  /**
   * Handle errors
   */
  handleError(error) {
    logger.error("Gemini API Error", error);

    if (error.response?.data?.error?.message) {
      return new Error(`Gemini API Error: ${error.response.data.error.message}`);
    } else if (error.message) {
      return new Error(`Gemini API Error: ${error.message}`);
    } else {
      return new Error("Gemini API 호출에 실패했습니다. API 키를 확인해주세요.");
    }
  }
}

export default GeminiProvider;
