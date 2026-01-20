import pool from "../config/database.js";

class SourceEvent {
  static async findByUserId(userId, cardIds = []) {
    const params = [userId];
    let query = "SELECT * FROM source_event WHERE user_id = ?";

    if (Array.isArray(cardIds) && cardIds.length > 0) {
      const placeholders = cardIds.map(() => "?").join(", ");
      query += ` AND card_id IN (${placeholders})`;
      params.push(...cardIds);
    }

    query += " ORDER BY occurred_at DESC, updated_at DESC";

    const [rows] = await pool.query(query, params);
    return rows;
  }
}

export default SourceEvent;

