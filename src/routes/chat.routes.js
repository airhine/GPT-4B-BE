import express from "express";
import { body, validationResult } from "express-validator";
import Chat from "../models/Chat.model.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { processLLMChat } from "../services/llm.service.js";

const router = express.Router();

router.use(authenticate);

// @route   GET /api/chat
// @desc    Get all chat conversations
// @access  Private
router.get("/", async (req, res) => {
  try {
    const chats = await Chat.findByUserId(req.user.id, true);

    res.json({
      success: true,
      data: chats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/chat/:id
// @desc    Get single chat conversation
// @access  Private
router.get("/:id", async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id, req.user.id);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    res.json({
      success: true,
      data: chat,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/chat
// @desc    Create new chat or send message
// @access  Private
router.post(
  "/",
  [
    body("message").notEmpty().trim(),
    body("llmProvider").optional().isIn(["gpt", "claude", "gemini"]),
    body("chatId").optional(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { message, llmProvider = "gpt", chatId } = req.body;
      console.log("Chat request:", { message: message?.substring(0, 50), llmProvider, chatId, userId: req.user.id });

      let chat;

      if (chatId) {
        // Continue existing chat
        console.log("Finding existing chat:", chatId);
        chat = await Chat.findById(chatId, req.user.id);

        if (!chat) {
          return res.status(404).json({
            success: false,
            message: "Chat not found",
          });
        }
        console.log("Found existing chat:", chat.id);
      } else {
        // Create new chat
        console.log("Creating new chat");
        chat = await Chat.create({
          userId: req.user.id,
          llmProvider,
          messages: [],
          title: message.substring(0, 50), // Use first 50 chars as title
        });
        console.log("Created new chat:", chat.id);
      }

      // Add user message
      chat.messages.push({
        role: "user",
        content: message,
        timestamp: new Date(),
      });

      // Get LLM response
      let llmResponse;
      try {
        console.log("Calling LLM with messages:", chat.messages.length, "messages");
        llmResponse = await processLLMChat(chat.messages, llmProvider);
        console.log("LLM response received, length:", llmResponse?.length);
      } catch (llmError) {
        console.error("LLM processing error:", llmError);
        console.error("LLM error stack:", llmError.stack);
        return res.status(500).json({
          success: false,
          message: llmError.message || "LLM 처리 중 오류가 발생했습니다.",
        });
      }

      // Add assistant message
      chat.messages.push({
        role: "assistant",
        content: llmResponse,
        timestamp: new Date(),
      });

      // Update chat with new messages
      try {
        console.log("Updating chat with", chat.messages.length, "messages");
        console.log("Messages before update:", JSON.stringify(chat.messages, null, 2));
        chat = await Chat.update(chat.id, req.user.id, {
          messages: chat.messages,
        });
        console.log("Chat updated successfully");
        console.log("Chat after update:", JSON.stringify(chat, null, 2));
        console.log("Chat messages type:", typeof chat.messages);
        console.log("Chat messages is array:", Array.isArray(chat.messages));
      } catch (updateError) {
        console.error("Chat update error:", updateError);
        console.error("Update error stack:", updateError.stack);
        return res.status(500).json({
          success: false,
          message: `채팅 저장 중 오류가 발생했습니다: ${updateError.message}`,
        });
      }

      // Ensure messages is an array (not a string)
      if (chat && typeof chat.messages === 'string') {
        try {
          chat.messages = JSON.parse(chat.messages);
        } catch (parseError) {
          console.error("Failed to parse messages in response:", parseError);
        }
      }

      console.log("Final chat object before sending:", {
        id: chat.id,
        messagesCount: Array.isArray(chat.messages) ? chat.messages.length : 'not array',
        messagesType: typeof chat.messages,
        lastMessage: Array.isArray(chat.messages) && chat.messages.length > 0 
          ? chat.messages[chat.messages.length - 1] 
          : null
      });

      res.json({
        success: true,
        data: chat,
      });
    } catch (error) {
      console.error("Chat route error:", error);
      console.error("Error stack:", error.stack);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        code: error.code,
      });
      res.status(500).json({
        success: false,
        message: error.message || "서버 오류가 발생했습니다.",
      });
    }
  }
);

// @route   DELETE /api/chat/:id
// @desc    Delete chat conversation
// @access  Private
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Chat.delete(req.params.id, req.user.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    res.json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
