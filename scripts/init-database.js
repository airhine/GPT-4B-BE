import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Windows에서 UTF-8 인코딩 설정
if (process.platform === 'win32') {
  try {
    // PowerShell에서 실행 시 UTF-8 설정
    process.stdout.setDefaultEncoding('utf8');
    process.stderr.setDefaultEncoding('utf8');
  } catch (e) {
    // 무시
  }
}

// 환경 변수 로드
dotenv.config();

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'peter0524!';
const DB_NAME = process.env.DB_NAME || 'backendTest';
const DB_PORT = process.env.DB_PORT || 3306;

async function initializeDatabase() {
  let connection;
  
  try {
    console.log('🔌 MySQL 서버에 연결 중...');
    console.log(`   호스트: ${DB_HOST}:${DB_PORT}`);
    console.log(`   사용자: ${DB_USER}`);
    
    // 먼저 MySQL 서버에 연결 (데이터베이스 없이)
    connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      port: DB_PORT,
    });

    console.log('✅ MySQL 서버 연결 성공!');

    // 데이터베이스 생성
    console.log(`\n📦 데이터베이스 '${DB_NAME}' 생성 중...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ 데이터베이스 '${DB_NAME}' 생성/확인 완료!`);

    // 데이터베이스 선택
    await connection.query(`USE \`${DB_NAME}\``);

    // 테이블 생성
    console.log('\n📋 테이블 생성 중...');

    // Users 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        name VARCHAR(255),
        phone VARCHAR(50),
        profileImage VARCHAR(500),
        oauthProvider ENUM('google', 'apple') NULL,
        oauthId VARCHAR(255),
        subscription ENUM('free', 'premium') DEFAULT 'free',
        cardLimit INT DEFAULT 200,
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_oauth (oauthProvider, oauthId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('   ✅ users 테이블 생성 완료');

    // BusinessCards 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS business_cards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        position VARCHAR(255),
        company VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        memo TEXT,
        image TEXT,
        design ENUM('design-1', 'design-2', 'design-3', 'design-4', 'design-5', 'design-6') DEFAULT 'design-1',
        isFavorite BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_userId (userId),
        INDEX idx_company (company),
        INDEX idx_name (name),
        INDEX idx_createdAt (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('   ✅ business_cards 테이블 생성 완료');

    // Gifts 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        cardId INT NOT NULL,
        giftName VARCHAR(255) NOT NULL,
        giftDescription TEXT,
        giftImage VARCHAR(500),
        price DECIMAL(10, 2),
        category VARCHAR(100),
        purchaseDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        occasion VARCHAR(100),
        notes TEXT,
        year VARCHAR(4),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (cardId) REFERENCES business_cards(id) ON DELETE CASCADE,
        INDEX idx_userId (userId),
        INDEX idx_cardId (cardId),
        INDEX idx_year (year),
        INDEX idx_purchaseDate (purchaseDate)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('   ✅ gifts 테이블 생성 완료');

    // Events 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        startDate DATETIME NOT NULL,
        endDate DATETIME NOT NULL,
        category ENUM('미팅', '업무', '개인', '기타') DEFAULT '기타',
        color VARCHAR(20) DEFAULT '#9ca3af',
        description TEXT,
        location VARCHAR(255),
        memo TEXT,
        notification VARCHAR(50),
        googleCalendarEventId VARCHAR(255),
        isAllDay BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_userId (userId),
        INDEX idx_startDate (startDate),
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('   ✅ events 테이블 생성 완료');

    // Chats 테이블
    await connection.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        llmProvider ENUM('gpt', 'claude', 'gemini') DEFAULT 'gpt',
        title VARCHAR(255),
        messages JSON,
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_userId (userId),
        INDEX idx_createdAt (createdAt),
        INDEX idx_isActive (isActive)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('   ✅ chats 테이블 생성 완료');

    console.log('\n✅ 데이터베이스 초기화 완료!');
    console.log('\n📊 테이블 목록:');
    const [tables] = await connection.query('SHOW TABLES');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 MySQL 서버가 실행 중인지 확인하세요:');
      console.error('   npm run mysql:start');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 사용자 이름 또는 비밀번호가 올바른지 확인하세요:');
      console.error('   .env 파일의 DB_USER와 DB_PASSWORD를 확인하세요.');
    } else {
      console.error('\n💡 오류 코드:', error.code);
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initializeDatabase();

