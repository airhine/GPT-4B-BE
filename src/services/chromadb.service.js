import { getOrCreateCollection } from "../config/chromadb.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CSV 파일을 파싱하여 배열로 변환
 * @param {string} csvPath - CSV 파일 경로
 * @returns {Array} 파싱된 데이터 배열
 */
const parseCSV = (csvPath) => {
  try {
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const lines = csvContent.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error("CSV 파일이 비어있습니다.");
    }

    // 헤더 파싱
    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().replace(/^"|"$/g, ""));

    // 데이터 파싱
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let currentValue = "";
      let inQuotes = false;

      // 따옴표 처리하여 CSV 파싱
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(currentValue.trim().replace(/^"|"$/g, ""));
          currentValue = "";
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim().replace(/^"|"$/g, ""));

      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });
        data.push(row);
      }
    }

    return data;
  } catch (error) {
    console.error("❌ CSV 파싱 오류:", error.message);
    throw error;
  }
};

/**
 * embedding_json 문자열을 배열로 파싱
 * @param {string} embeddingJson - JSON 문자열
 * @returns {Array} 임베딩 벡터 배열
 */
const parseEmbedding = (embeddingJson) => {
  try {
    if (!embeddingJson || embeddingJson.trim() === "") {
      return null;
    }
    return JSON.parse(embeddingJson);
  } catch (error) {
    console.error("❌ 임베딩 파싱 오류:", error.message);
    return null;
  }
};

/**
 * CSV 파일에서 데이터를 읽어서 ChromaDB에 저장
 * @param {string} csvPath - CSV 파일 경로
 * @returns {Object} 저장 결과
 */
const loadGiftDataFromCSV = async (csvPath) => {
  try {
    // CSV 파일 파싱
    const csvData = parseCSV(csvPath);
    console.log(`📄 CSV 파일에서 ${csvData.length}개의 레코드를 읽었습니다.`);

    // 컬렉션 가져오기 또는 생성
    const collection = await getOrCreateCollection();

    // 데이터 준비
    const ids = [];
    const documents = [];
    const embeddings = [];
    const metadatas = [];

    for (const row of csvData) {
      // 필수 필드 확인
      if (!row.index || !row.unified_text) {
        console.warn(`⚠️  index 또는 unified_text가 없는 레코드를 건너뜁니다.`);
        continue;
      }

      // 임베딩 파싱
      const embedding = parseEmbedding(row.embedding_json);
      if (!embedding || !Array.isArray(embedding)) {
        console.warn(
          `⚠️  유효한 임베딩이 없는 레코드 (index: ${row.index})를 건너뜁니다.`
        );
        continue;
      }

      // 데이터 추가
      ids.push(String(row.index));
      documents.push(row.unified_text);
      embeddings.push(embedding);

      // 메타데이터 준비 (임베딩 관련 필드 제외)
      const metadata = {
        url: row.url || "",
        name: row.name || "",
        price: row.price || "",
        image: row.image || "",
        category: row.category || "",
        product_name: row.product_name || "",
        event: row.event || "",
        vibe: row.vibe || "",
        utility: row.utility || "",
        etc: row.etc || "",
      };

      metadatas.push(metadata);
    }

    if (ids.length === 0) {
      throw new Error("저장할 유효한 데이터가 없습니다.");
    }

    console.log(`📦 ${ids.length}개의 레코드를 ChromaDB에 저장 중...`);

    // ChromaDB에 추가
    await collection.add({
      ids: ids,
      documents: documents,
      embeddings: embeddings,
      metadatas: metadatas,
    });

    console.log(`✅ ${ids.length}개의 레코드가 성공적으로 저장되었습니다.`);

    return {
      success: true,
      totalRecords: csvData.length,
      savedRecords: ids.length,
      skippedRecords: csvData.length - ids.length,
    };
  } catch (error) {
    console.error("❌ ChromaDB 저장 오류:", error.message);
    throw error;
  }
};

/**
 * ChromaDB에서 유사한 선물 검색
 * @param {Array} queryEmbedding - 검색할 임베딩 벡터
 * @param {number} nResults - 반환할 결과 수 (기본값: 10)
 * @returns {Array} 검색 결과
 */
const searchSimilarGifts = async (queryEmbedding, nResults = 10) => {
  try {
    const collection = await getOrCreateCollection();

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: nResults,
      include: ["documents", "metadatas", "distances"],
    });

    return results;
  } catch (error) {
    console.error("❌ ChromaDB 검색 오류:", error.message);
    throw error;
  }
};

/**
 * ChromaDB 컬렉션의 모든 데이터 조회
 * @param {number} limit - 조회할 최대 개수
 * @returns {Object} 조회 결과
 */
const getAllGifts = async (limit = 100) => {
  try {
    const collection = await getOrCreateCollection();

    const results = await collection.get({
      limit: limit,
    });

    return results;
  } catch (error) {
    console.error("❌ ChromaDB 조회 오류:", error.message);
    throw error;
  }
};

/**
 * ChromaDB 컬렉션 초기화 (모든 데이터 삭제)
 * @returns {boolean} 성공 여부
 */
const clearCollection = async () => {
  try {
    const { chromaClient, COLLECTION_NAME } = await import(
      "../config/chromadb.js"
    );

    // 컬렉션 삭제
    await chromaClient.deleteCollection({ name: COLLECTION_NAME });
    console.log("✅ ChromaDB 컬렉션이 삭제되었습니다.");

    // 새 컬렉션 생성
    await getOrCreateCollection();
    console.log("✅ 새로운 ChromaDB 컬렉션이 생성되었습니다.");

    return true;
  } catch (error) {
    console.error("❌ ChromaDB 초기화 오류:", error.message);
    throw error;
  }
};

export {
  loadGiftDataFromCSV,
  searchSimilarGifts,
  getAllGifts,
  clearCollection,
  parseCSV,
  parseEmbedding,
};

