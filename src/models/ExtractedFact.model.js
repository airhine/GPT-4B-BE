import pool from "../config/database.js";

class ExtractedFact {
  static async findByUserId(userId, cardIds = []) {
    const params = [userId];
    let query = "SELECT * FROM extracted_fact WHERE user_id = ?";

    if (Array.isArray(cardIds) && cardIds.length > 0) {
      const placeholders = cardIds.map(() => "?").join(", ");
      query += ` AND card_id IN (${placeholders})`;
      params.push(...cardIds);
    }

    query += " ORDER BY id DESC";

    const [rows] = await pool.query(query, params);
    return rows;
  }

  static async findByUserIdAndCardId(userId, cardId) {
    const [rows] = await pool.query(
      "SELECT * FROM extracted_fact WHERE user_id = ? AND card_id = ? ORDER BY id DESC",
      [userId, cardId]
    );
    return rows;
  }
}

export default ExtractedFact;

