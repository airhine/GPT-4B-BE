import pool from '../config/database.js';

class Chat {
  // Find all chats for a user
  static async findByUserId(userId, isActive = true) {
    const [rows] = await pool.query(
      `SELECT id, userId, llmProvider, title, isActive, createdAt, updatedAt,
       JSON_LENGTH(messages) as messageCount
       FROM chats
       WHERE userId = ? AND isActive = ?
       ORDER BY updatedAt DESC`,
      [userId, isActive]
    );
    return rows;
  }

  // Find chat by ID
  static async findById(id, userId = null) {
    let query = 'SELECT * FROM chats WHERE id = ?';
    const params = [id];

    if (userId) {
      query += ' AND userId = ?';
      params.push(userId);
    }

    const [rows] = await pool.query(query, params);
    if (rows[0]) {
      // Parse JSON messages
      const messagesRaw = rows[0].messages;
      console.log('findById - Raw messages type:', typeof messagesRaw);
      
      // Safe preview logging
      if (typeof messagesRaw === 'string') {
        console.log('findById - Raw messages preview:', messagesRaw.substring(0, 100));
      } else if (messagesRaw !== null && messagesRaw !== undefined) {
        console.log('findById - Raw messages preview:', JSON.stringify(messagesRaw).substring(0, 100));
      } else {
        console.log('findById - Raw messages is null/undefined');
      }
      
      try {
        if (typeof messagesRaw === 'string') {
          rows[0].messages = JSON.parse(messagesRaw || '[]');
        } else if (Array.isArray(messagesRaw)) {
          rows[0].messages = messagesRaw;
        } else if (messagesRaw === null || messagesRaw === undefined) {
          rows[0].messages = [];
        } else {
          console.warn('Unexpected messages type:', typeof messagesRaw, messagesRaw);
          rows[0].messages = [];
        }
        console.log('findById - Parsed messages count:', rows[0].messages?.length || 0);
      } catch (parseError) {
        console.error('Error parsing messages JSON:', parseError);
        console.error('Failed to parse:', messagesRaw);
        rows[0].messages = [];
      }
    }
    return rows[0] || null;
  }

  // Create new chat
  static async create(chatData) {
    const {
      userId,
      llmProvider = 'gpt',
      title,
      messages = []
    } = chatData;

    // Convert Date objects to ISO strings for JSON serialization
    const serializedMessages = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
    }));

    try {
      const [result] = await pool.query(
        `INSERT INTO chats (userId, llmProvider, title, messages, isActive)
         VALUES (?, ?, ?, ?, TRUE)`,
        [userId, llmProvider, title, JSON.stringify(serializedMessages)]
      );

      return await this.findById(result.insertId);
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  // Update chat (mainly for adding messages)
  static async update(id, userId, updateData) {
    const fields = [];
    const values = [];
    let messagesToSave = null;

    // Handle messages array
    if (updateData.messages) {
      if (Array.isArray(updateData.messages)) {
        // Convert Date objects to ISO strings for JSON serialization
        const serializedMessages = updateData.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
        }));
        messagesToSave = JSON.stringify(serializedMessages);
        fields.push('messages = ?');
        values.push(messagesToSave);
        console.log('Saving messages:', serializedMessages.length, 'messages');
      } else if (typeof updateData.messages === 'string') {
        // Already stringified, use as is
        fields.push('messages = ?');
        values.push(updateData.messages);
      } else {
        console.error('Invalid messages format:', typeof updateData.messages);
        throw new Error('Messages must be an array or JSON string');
      }
    }

    // Handle other fields
    Object.keys(updateData).forEach(key => {
      if (key !== 'messages' && updateData[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    if (fields.length === 0) {
      return await this.findById(id, userId);
    }

    values.push(id, userId);
    
    try {
      const [result] = await pool.query(
        `UPDATE chats SET ${fields.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?`,
        values
      );

      console.log('Update result:', result.affectedRows, 'rows affected');

      // Verify the update by querying directly
      const [verifyRows] = await pool.query(
        'SELECT messages FROM chats WHERE id = ? AND userId = ?',
        [id, userId]
      );

      if (verifyRows[0]) {
        const verifiedMessages = verifyRows[0].messages;
        if (typeof verifiedMessages === 'string') {
          console.log('Verified messages in DB:', verifiedMessages.substring(0, 100));
        } else if (verifiedMessages !== null && verifiedMessages !== undefined) {
          console.log('Verified messages in DB:', JSON.stringify(verifiedMessages).substring(0, 100));
        } else {
          console.log('Verified messages in DB: null/undefined');
        }
      }

      const chat = await this.findById(id, userId);
      
      // If findById returns empty messages, parse from what we saved
      if (chat && (!chat.messages || chat.messages.length === 0) && messagesToSave) {
        try {
          chat.messages = JSON.parse(messagesToSave);
          console.log('Restored messages from saved data:', chat.messages.length);
        } catch (parseError) {
          console.error('Failed to restore messages:', parseError);
        }
      }

      return chat;
    } catch (error) {
      console.error('Error updating chat:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  // Soft delete chat
  static async delete(id, userId) {
    const [result] = await pool.query(
      'UPDATE chats SET isActive = FALSE WHERE id = ? AND userId = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }
}

export default Chat;
