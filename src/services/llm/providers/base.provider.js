/**
 * Base LLM Provider Interface
 * 모든 LLM Provider가 구현해야 하는 공통 인터페이스
 */

export class BaseProvider {
  constructor(config = {}) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  /**
   * Chat completion - 채팅 완성
   * @param {Array} messages - 메시지 배열 [{ role, content }]
   * @param {Object} options - 추가 옵션 (temperature, max_tokens 등)
   * @returns {Promise<string>} LLM 응답 텍스트
   */
  async chat(messages, options = {}) {
    throw new Error("chat() method must be implemented by provider");
  }

  /**
   * Generate embedding - 벡터 임베딩 생성
   * @param {string|Array<string>} text - 임베딩할 텍스트
   * @param {Object} options - 추가 옵션
   * @returns {Promise<Array<number>>|Promise<Array<Array<number>>>} 임베딩 벡터
   */
  async embed(text, options = {}) {
    throw new Error("embed() method must be implemented by provider");
  }

  /**
   * Check if provider is available (API key configured)
   * @returns {boolean}
   */
  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Format messages for provider-specific format
   * @param {Array} messages - 표준 메시지 형식
   * @returns {Array} Provider별 형식으로 변환된 메시지
   */
  formatMessages(messages) {
    return messages;
  }

  /**
   * Parse response from provider-specific format
   * @param {Object} response - Provider 응답
   * @returns {string} 텍스트 응답
   */
  parseResponse(response) {
    throw new Error("parseResponse() method must be implemented by provider");
  }

  /**
   * Handle errors from provider
   * @param {Error} error - 에러 객체
   * @returns {Error} 처리된 에러
   */
  handleError(error) {
    return error;
  }
}

export default BaseProvider;
