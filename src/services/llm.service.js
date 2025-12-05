import axios from "axios";

/**
 * Process chat message with LLM
 * @param {Array} messages - Array of message objects with role and content
 * @param {string} provider - LLM provider ('gpt', 'claude', 'gemini')
 * @returns {Promise<string>} LLM response
 */
export const processLLMChat = async (messages, provider = "gpt") => {
  try {
    if (provider === "gpt") {
      return await processWithGPT(messages);
    } else if (provider === "gemini") {
      return await processWithGemini(messages);
    } else {
      throw new Error(
        `Unsupported LLM provider: ${provider}. Supported providers: 'gpt', 'gemini'.`
      );
    }
  } catch (error) {
    console.error("LLM Service Error:", error);
    throw new Error("LLM processing failed");
  }
};

/**
 * Process with OpenAI GPT
 */
const processWithGPT = async (messages) => {
  if (!process.env.OPENAI_API_KEY) {
    return mockLLMResponse();
  }

  try {
    // Format messages for OpenAI
    // OpenAI expects { role: "user" | "assistant" | "system", content: "..." }
    const formattedMessages = messages.map((msg) => {
      let role = msg.role;
      // Map "model" role to "assistant" for OpenAI
      if (role === "model") {
        role = "assistant";
      }
      return {
        role: role,
        content: msg.content,
      };
    });

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: formattedMessages,
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    if (response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    }

    throw new Error("OpenAI API returned no choices");
  } catch (error) {
    console.error("OpenAI API Error:", error);
    
    // OpenAI API 에러 메시지 추출
    if (error.response?.data?.error?.message) {
      throw new Error(`OpenAI API Error: ${error.response.data.error.message}`);
    } else if (error.message) {
      throw new Error(`OpenAI API Error: ${error.message}`);
    } else {
      throw new Error("OpenAI API 호출에 실패했습니다. API 키를 확인해주세요.");
    }
  }
};

/**
 * Process with Google Gemini
 */
const processWithGemini = async (messages) => {
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    return mockLLMResponse();
  }

  try {
    // Format messages for Gemini
    // Gemini expects { role: "user" | "model", parts: [{ text: "..." }] }
    const formattedContents = messages.map((msg) => {
      let role = "user";
      if (msg.role === "assistant" || msg.role === "system") {
        role = "model";
      }

      return {
        role: role,
        parts: [{ text: msg.content }],
      };
    });

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
      {
        contents: formattedContents,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.candidates && response.data.candidates.length > 0) {
      return response.data.candidates[0].content.parts[0].text;
    }

    return mockLLMResponse();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return mockLLMResponse();
  }
};

/**
 * Mock LLM response for development
 */
const mockLLMResponse = () => {
  return "안녕하세요! GPT-4b입니다. 어떻게 도와드릴까요? (This is a mock response. Please configure LLM API keys in .env file)";
};
