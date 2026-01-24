import pool from "../config/database.js";

class CardGroup {
  // 사용자의 모든 그룹 조회
  static async findByUserId(userId) {
    const [rows] = await pool.query(
      `SELECT * FROM card_groups WHERE userId = ? ORDER BY displayOrder ASC, createdAt DESC`,
      [userId]
    );
    return rows;
  }

  // 그룹 ID로 조회 (명함 포함)
  static async findById(groupId, userId) {
    const [rows] = await pool.query(
      `SELECT * FROM card_groups WHERE id = ? AND userId = ?`,
      [groupId, userId]
    );
    if (rows.length === 0) return null;

    const group = rows[0];
    // 그룹에 속한 명함 ID들 조회
    const [cardRows] = await pool.query(
      `SELECT businessCardId FROM group_cards WHERE groupId = ?`,
      [groupId]
    );
    group.cardIds = cardRows.map(row => String(row.businessCardId));
    return group;
  }

  // 그룹 생성
  static async create(userId, name, cardIds = []) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 현재 사용자의 그룹 개수 가져오기 (순서 설정용)
      const [countRows] = await connection.query(
        `SELECT COUNT(*) as count FROM card_groups WHERE userId = ?`,
        [userId]
      );
      const displayOrder = countRows[0].count;

      // 그룹 생성
      const [result] = await connection.query(
        `INSERT INTO card_groups (userId, name, displayOrder) VALUES (?, ?, ?)`,
        [userId, name, displayOrder]
      );
      const groupId = result.insertId;

      // 명함 추가
      if (cardIds.length > 0) {
        const values = cardIds.map(cardId => [groupId, parseInt(cardId)]);
        await connection.query(
          `INSERT INTO group_cards (groupId, businessCardId) VALUES ?`,
          [values]
        );
      }

      await connection.commit();
      return await this.findById(groupId, userId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 그룹 수정
  static async update(groupId, userId, name, cardIds = null) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 그룹 이름 수정
      if (name) {
        await connection.query(
          `UPDATE card_groups SET name = ? WHERE id = ? AND userId = ?`,
          [name, groupId, userId]
        );
      }

      // 명함 목록 수정
      if (cardIds !== null) {
        // 기존 명함 삭제
        await connection.query(
          `DELETE FROM group_cards WHERE groupId = ?`,
          [groupId]
        );
        // 새 명함 추가
        if (cardIds.length > 0) {
          const values = cardIds.map(cardId => [groupId, parseInt(cardId)]);
          await connection.query(
            `INSERT INTO group_cards (groupId, businessCardId) VALUES ?`,
            [values]
          );
        }
      }

      await connection.commit();
      return await this.findById(groupId, userId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 그룹 삭제
  static async delete(groupId, userId) {
    const [result] = await pool.query(
      `DELETE FROM card_groups WHERE id = ? AND userId = ?`,
      [groupId, userId]
    );
    return result.affectedRows > 0;
  }

  // 그룹에 명함 추가
  static async addCard(groupId, cardId) {
    try {
      await pool.query(
        `INSERT IGNORE INTO group_cards (groupId, businessCardId) VALUES (?, ?)`,
        [groupId, cardId]
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  // 그룹에서 명함 제거
  static async removeCard(groupId, cardId) {
    const [result] = await pool.query(
      `DELETE FROM group_cards WHERE groupId = ? AND businessCardId = ?`,
      [groupId, cardId]
    );
    return result.affectedRows > 0;
  }

  // 그룹 순서 업데이트 (여러 그룹의 순서를 한 번에 업데이트)
  static async updateOrders(userId, groupOrders) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 각 그룹의 순서 업데이트
      for (const { groupId, displayOrder } of groupOrders) {
        const [result] = await connection.query(
          `UPDATE card_groups SET displayOrder = ? WHERE id = ? AND userId = ?`,
          [displayOrder, groupId, userId]
        );
        if (result.affectedRows === 0) {
          console.warn(`[그룹 순서 업데이트] 그룹 ID ${groupId}를 찾을 수 없거나 사용자 ID가 일치하지 않습니다.`);
        }
      }

      await connection.commit();
      console.log(`[그룹 순서 업데이트] 성공: ${groupOrders.length}개 그룹 업데이트 완료`);
      return true;
    } catch (error) {
      await connection.rollback();
      console.error('[그룹 순서 업데이트 에러]', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default CardGroup;
