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
  // 엄격하게 `^[1-9]\d*d$` 만 허용. `12h`, `0d`, `1w`, 숫자만 등은 부팅 시 즉시 실패.
  if (!/^[1-9]\d*d$/.test(refreshExpires)) {
    throw new Error(
      `JWT_REFRESH_EXPIRES_IN must match /^[1-9]\\d*d$/ (e.g. "30d"), got "${refreshExpires}"`,
    );
  }
  const refreshTtlDays = Number.parseInt(refreshExpires.slice(0, -1), 10);
  const accessTtl = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
  return {
    jwtSecret,
    accessTtl,
    accessTtlMs: parseTtlToMs(accessTtl),
    refreshTtlDays,
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  };
};

/**
 * JWT 형식 TTL 문자열을 ms로 변환. `15m`, `2h`, `7d`, `45s`, 또는 숫자(ms).
 * 잘못된 형식이면 throw — 부팅 시 fail-fast.
 *
 * @param {string | number} v
 * @returns {number}
 */
export const parseTtlToMs = (v) => {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  const str = String(v).trim();
  const m = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(str);
  if (!m) throw new Error(`Invalid TTL string: "${v}"`);
  const n = Number.parseInt(m[1], 10);
  const unit = m[2] ?? 'ms';
  const mul = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return n * mul;
};

/**
 * JWT access token 발급.
 *
 * #541: `schoolVerifiedAt` 도 payload 에 포함 (있을 때만).
 *  - hobby-api 등 다른 BE 가 학교 인증 가드 적용 시 cross-service DB lookup 없이
 *    JWT 만으로 학교 인증 상태를 확인할 수 있게 한다.
 *  - 호출자가 ISO 문자열로 normalize 해서 넘긴다 (Date 객체는 jwt.sign 으로
 *    serialize 시 형식이 일관되지 않아 명시 변환).
 *  - 미인증 사용자는 키 자체를 빼서 payload 작아지게 (optional 필드).
 *
 * @param {{ sub: string, email: string, name: string, schoolVerifiedAt?: string | null }} payload
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
  const { cookieDomain, cookieSecure, refreshTtlDays, accessTtlMs } = cfg;
  // access 쿠키 maxAge는 JWT TTL과 정확히 일치 → 조기 로그아웃·불필요 refresh 방지.
  res.cookie(
    ACCESS_COOKIE,
    accessToken,
    baseCookieOpts({
      cookieDomain,
      cookieSecure,
      maxAgeMs: accessTtlMs ?? parseTtlToMs(cfg.accessTtl),
    }),
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
