import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// Apple의 공개 키를 가져오기 위한 JWKS 클라이언트
const client = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  cacheMaxAge: 86400000, // 24시간 캐시
});

/**
 * Apple identityToken을 검증하고 사용자 정보를 반환합니다.
 * @param {string} identityToken - Apple identityToken (JWT)
 * @param {string} clientId - Apple Service ID (클라이언트 ID)
 * @returns {Promise<Object>} 검증된 사용자 정보 (sub, email 등)
 */
export const verifyAppleToken = async (identityToken, clientId) => {
  try {
    // 토큰을 디코딩하여 헤더 정보 가져오기
    const decoded = jwt.decode(identityToken, { complete: true });
    
    if (!decoded || !decoded.header || !decoded.header.kid) {
      throw new Error('Invalid token format');
    }

    // Apple의 공개 키 가져오기
    const key = await getKey(decoded.header.kid);
    
    // 토큰 검증
    const payload = jwt.verify(identityToken, key, {
      algorithms: ['RS256'],
      audience: clientId, // Apple Service ID
      issuer: 'https://appleid.apple.com',
    });

    // 사용자 정보 반환
    return {
      appleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified || false,
      // Apple은 첫 로그인 시에만 이메일을 제공할 수 있음
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Apple token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error(`Apple token verification failed: ${error.message}`);
    }
    throw new Error(`Apple token verification failed: ${error.message}`);
  }
};

/**
 * Apple JWKS에서 공개 키를 가져옵니다.
 * @param {string} kid - Key ID
 * @returns {Promise<string>} 공개 키
 */
const getKey = (kid) => {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) {
        return reject(err);
      }
      const signingKey = key.getPublicKey();
      resolve(signingKey);
    });
  });
};

/**
 * Apple OAuth 클라이언트 ID가 설정되어 있는지 확인
 * @returns {boolean}
 */
export const isAppleOAuthConfigured = () => {
  return !!process.env.APPLE_CLIENT_ID;
};
