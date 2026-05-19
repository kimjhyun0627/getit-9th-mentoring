/**
 * JWT access + opaque refresh token 발급/검증 + 쿠키 헬퍼.
 *
 * 정책:
 * - access:  JWT (HS256), TTL `JWT_ACCESS_EXPIRES_IN` (기본 15m)
 * - refresh: crypto.randomBytes(32) hex (opaque). DB엔 SHA-256 해시만 저장 → 회전 + 유출 방어
 * - 두 쿠키 모두 HttpOnly, SameSite=Lax, prod에선 Secure, COOKIE_DOMAIN 적용
 */
import crypto from 'node:crypto';

import { signJwt } from '@getit/auth-utils/server';

export const ACCESS_COOKIE = 'getit_jwt';
export const REFRESH_COOKIE = 'getit_refresh';

/**
 * 환경변수에서 cookie/jwt 설정 읽기. 서버 부팅마다 한 번씩 호출.
 *
 * @returns {{
 *   jwtSecret: string,
 *   accessTtl: string,
 *   refreshTtlDays: number,
 *   cookieDomain: string | undefined,
 *   cookieSecure: boolean,
 * }}
 */
export const readAuthEnv = () => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be >= 32 chars');
  }
  const refreshExpires = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';
  const refreshTtlDays = Number.parseInt(String(refreshExpires).replace(/d$/, ''), 10) || 30;
  return {
    jwtSecret,
    accessTtl: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshTtlDays,
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  };
};

/**
 * JWT access token 발급.
 *
 * @param {{ sub: string, email: string, name: string }} payload
 * @param {string} secret
 * @param {string | number} expiresIn
 * @returns {string}
 */
export const generateAccessToken = (payload, secret, expiresIn) =>
  signJwt(payload, secret, { expiresIn });

/**
 * Opaque refresh token (64 hex chars).
 *
 * @returns {string}
 */
export const generateRefreshToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Refresh token의 SHA-256 해시 (hex). DB 저장용.
 *
 * @param {string} token
 * @returns {string}
 */
export const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token, 'utf8').digest('hex');

/**
 * 쿠키 공통 옵션.
 *
 * @param {{ cookieDomain?: string, cookieSecure: boolean, maxAgeMs: number }} cfg
 * @returns {import('express').CookieOptions}
 */
const baseCookieOpts = ({ cookieDomain, cookieSecure, maxAgeMs }) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: cookieSecure,
  domain: cookieDomain || undefined,
  path: '/',
  maxAge: maxAgeMs,
});

/**
 * access + refresh 쿠키를 res에 set.
 *
 * @param {import('express').Response} res
 * @param {{ accessToken: string, refreshToken: string }} tokens
 * @param {ReturnType<typeof readAuthEnv>} cfg
 */
export const setAuthCookies = (res, { accessToken, refreshToken }, cfg) => {
  const { cookieDomain, cookieSecure, refreshTtlDays } = cfg;
  // access: 15분 (대략) — 실 만료는 JWT 자체가 강제. 쿠키 maxAge는 길게 두면 클라가 헛 호출하니 동일하게.
  res.cookie(
    ACCESS_COOKIE,
    accessToken,
    baseCookieOpts({ cookieDomain, cookieSecure, maxAgeMs: 15 * 60 * 1000 }),
  );
  res.cookie(
    REFRESH_COOKIE,
    refreshToken,
    baseCookieOpts({
      cookieDomain,
      cookieSecure,
      maxAgeMs: refreshTtlDays * 24 * 60 * 60 * 1000,
    }),
  );
};

/**
 * 로그아웃/실패 시 두 쿠키 제거.
 *
 * @param {import('express').Response} res
 * @param {ReturnType<typeof readAuthEnv>} cfg
 */
export const clearAuthCookies = (res, cfg) => {
  const opts = {
    httpOnly: true,
    sameSite: 'lax',
    secure: cfg.cookieSecure,
    domain: cfg.cookieDomain || undefined,
    path: '/',
  };
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
};
