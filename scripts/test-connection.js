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

async function testConnection() {
  let connection;
  
  try {
    console.log('🔌 MySQL 연결 테스트 중...');
    console.log(`   호스트: ${DB_HOST}:${DB_PORT}`);
    console.log(`   사용자: ${DB_USER}`);
    console.log(`   데이터베이스: ${DB_NAME}`);
    
    connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      port: DB_PORT,
    });

    console.log('✅ MySQL 연결 성공!');

    // 서버 정보 확인
    const [serverInfo] = await connection.query('SELECT VERSION() as version');
    console.log(`\n📊 MySQL 서버 정보:`);
    console.log(`   버전: ${serverInfo[0].version}`);

    // 데이터베이스 정보 확인
    const [dbInfo] = await connection.query(`SELECT DATABASE() as current_db`);
    console.log(`   현재 데이터베이스: ${dbInfo[0].current_db}`);

    // 테이블 목록 확인
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`\n📋 테이블 목록 (${tables.length}개):`);
    if (tables.length === 0) {
      console.log('   ⚠️  테이블이 없습니다. 데이터베이스를 초기화하세요: npm run db:init');
    } else {
      tables.forEach((table, index) => {
        const tableName = Object.values(table)[0];
        console.log(`   ${index + 1}. ${tableName}`);
      });
    }

    // 각 테이블의 레코드 수 확인
    if (tables.length > 0) {
      console.log(`\n📈 테이블별 레코드 수:`);
      for (const table of tables) {
        const tableName = Object.values(table)[0];
        const [count] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        console.log(`   ${tableName}: ${count[0].count}개`);
      }
    }

    console.log('\n✅ 연결 테스트 완료!');

  } catch (error) {
    console.error('\n❌ 연결 실패:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 MySQL 서버가 실행 중인지 확인하세요:');
      console.error('   npm run mysql:start');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 사용자 이름 또는 비밀번호가 올바른지 확인하세요:');
      console.error('   .env 파일의 DB_USER와 DB_PASSWORD를 확인하세요.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 데이터베이스가 존재하지 않습니다:');
      console.error('   npm run db:init 을 실행하여 데이터베이스를 생성하세요.');
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

testConnection();

