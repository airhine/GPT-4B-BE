import { ChromaClient } from "chromadb";
import dotenv from "dotenv";

dotenv.config();

// ChromaDB 클라이언트 초기화
const chromaClient = new ChromaClient({
  path: process.env.CHROMADB_PATH || "http://localhost:8000",
});

// 컬렉션 이름
const COLLECTION_NAME = "gift_embeddings";

// ChromaDB 연결 테스트
const testConnection = async () => {
  try {
    await chromaClient.heartbeat();
    console.log("✅ ChromaDB connected successfully");
    return true;
  } catch (error) {
    console.error("❌ ChromaDB connection error:", error.message);
    return false;
  }
};

// 컬렉션 가져오기 또는 생성
const getOrCreateCollection = async () => {
  try {
    // 기존 컬렉션이 있는지 확인
    const collections = await chromaClient.listCollections();
    const existingCollection = collections.find(
      (col) => col.name === COLLECTION_NAME
    );

    if (existingCollection) {
      return await chromaClient.getCollection({ name: COLLECTION_NAME });
    }

    // 컬렉션이 없으면 생성
    return await chromaClient.createCollection({
      name: COLLECTION_NAME,
      metadata: {
        description: "선물 정보 임베딩 데이터",
      },
    });
  } catch (error) {
    console.error("❌ Error getting/creating collection:", error.message);
    throw error;
  }
};

export { chromaClient, COLLECTION_NAME, testConnection, getOrCreateCollection };
export default chromaClient;

