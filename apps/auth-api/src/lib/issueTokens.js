/**
 * `issueTokensAndCookies` 공용 헬퍼 — auth.js / me.js / 향후 verify-school 등에서
 * 동일한 JWT payload 정책으로 access + refresh 토큰을 발급한다.
 *
 * 정책:
 *  - JWT payload: { sub, email, name } + nickname / schoolVerifiedAt 가 있을 때만 부착.
 *    빈 문자열 / 공백은 키 누락.
 *  - refresh token: opaque 64-hex + SHA-256 해시만 DB 저장.
 *  - tx (Prisma transaction) 가 주어지면 그 컨텍스트에서 refresh token 을 생성.
 *
 * 분리 이유 (letter 무한 redirect fix):
 *  - PATCH /api/me/nickname 이 새 nickname 반영된 access token 을 즉시 발급해야
 *    NicknameOnboardingGuard 가 다음 요청에서 nickname 키 있음을 확인할 수 있음.
 *  - auth.js 의 private 함수를 노출하지 않고 lib 으로 끌어올림 — 호출자 늘어나도
 *    단일 진실 공급원 유지.
 */
import { prisma } from './prisma.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  readAuthEnv,
  setAuthCookies,
} from './tokens.js';

/**
 * @param {{
 *   id: string,
 *   email: string,
 *   name: string,
 *   nickname?: string | null,
 *   schoolVerifiedAt?: Date | string | null,
 * }} user
 * @returns {{
 *   sub: string,
 *   email: string,
 *   name: string,
 *   nickname?: string,
 *   schoolVerifiedAt?: string,
 * }}
 */
export const buildAccessTokenPayload = (user) => {
  const tokenPayload = { sub: user.id, email: user.email, name: user.name };
  if (typeof user.nickname === 'string' && user.nickname.trim().length > 0) {
    tokenPayload.nickname = user.nickname;
  }
  if (user.schoolVerifiedAt) {
    tokenPayload.schoolVerifiedAt =
      user.schoolVerifiedAt instanceof Date
        ? user.schoolVerifiedAt.toISOString()
        : String(user.schoolVerifiedAt);
  }
  return tokenPayload;
};

/**
 * access + refresh 토큰 발급 + DB 저장 + 쿠키 set.
 *
 * @param {{
 *   id: string,
 *   email: string,
 *   name: string,
 *   nickname?: string | null,
 *   schoolVerifiedAt?: Date | string | null,
 * }} user
 * @param {import('express').Response} res
 * @param {{ refreshToken: { create: typeof prisma.refreshToken.create } }} [tx]
 */
export const issueTokensAndCookies = async (user, res, tx) => {
  const cfg = readAuthEnv();
  const client = tx ?? prisma;
  const tokenPayload = buildAccessTokenPayload(user);
  const accessToken = generateAccessToken(tokenPayload, cfg.jwtSecret, cfg.accessTtl);
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + cfg.refreshTtlDays * 24 * 60 * 60 * 1000);
  await client.refreshToken.create({
    data: { userId: user.id, tokenHash: hashRefreshToken(refreshToken), expiresAt },
  });
  setAuthCookies(res, { accessToken, refreshToken }, cfg);
  return { accessToken, refreshToken };
};
