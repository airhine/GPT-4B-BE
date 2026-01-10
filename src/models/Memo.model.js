import pool from '../config/database.js';

class Memo {
  // Find all memos for a business card
  static async findByBusinessCardId(businessCardId, userId = null) {
    let query = 'SELECT * FROM memo WHERE business_card_id = ?';
    const params = [businessCardId];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY updated_at DESC';

    const [rows] = await pool.query(query, params);
    return rows;
  }

  // Find memo by ID
  static async findById(id, userId = null) {
    let query = 'SELECT * FROM memo WHERE id = ?';
    const params = [id];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    const [rows] = await pool.query(query, params);
    return rows[0] || null;
  }

  // Create new memo
  static async create(memoData) {
    const { userId, businessCardId, content } = memoData;

    const [result] = await pool.query(
      'INSERT INTO memo (user_id, business_card_id, content) VALUES (?, ?, ?)',
      [userId, businessCardId, content]
    );

    return await this.findById(result.insertId);
  }

  // Update memo
  static async update(id, userId, content) {
    await pool.query(
      'UPDATE memo SET content = ? WHERE id = ? AND user_id = ?',
      [content, id, userId]
    );

    return await this.findById(id, userId);
  }

  // Delete memo
  static async delete(id, userId) {
    const [result] = await pool.query(
      'DELETE FROM memo WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }
}

export default Memo;
