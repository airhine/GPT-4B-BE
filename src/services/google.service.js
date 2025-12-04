import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Google ID Token을 검증하고 사용자 정보를 반환합니다.
 * @param {string} idToken - Google ID Token
 * @returns {Promise<Object>} 검증된 사용자 정보 (sub, email, name, picture 등)
 */
export const verifyGoogleToken = async (idToken) => {
  try {
    // ID Token 검증
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    
    // 필요한 사용자 정보 반환
    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload.name,
      picture: payload.picture,
      givenName: payload.given_name,
      familyName: payload.family_name,
    };
  } catch (error) {
    throw new Error(`Google token verification failed: ${error.message}`);
  }
};

/**
 * Google OAuth 클라이언트 ID가 설정되어 있는지 확인
 * @returns {boolean}
 */
export const isGoogleOAuthConfigured = () => {
  return !!process.env.GOOGLE_CLIENT_ID;
};
