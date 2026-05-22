/**
 * auth-api 통합 테스트 공용 헬퍼 (#546 — CR 파일 분할).
 *
 * - `auth-signup-login.test.js`, `auth-refresh-logout.test.js`, 그 외 라우터 테스트가
 *   `VALID_SIGNUP` / `readCookie` / `signupOk` 를 공유.
 * - 한 파일 ≤ 300줄 가이드 준수를 위해 분리.
 */
import request from 'supertest';

export const VALID_SIGNUP = {
  email: 'alice@get-it.cloud',
  // #265 강한 정책 — 영문 + 숫자 2종 포함.
  password: 'Pass1234',
  passwordConfirm: 'Pass1234',
  name: 'Alice',
  // #237 약관 동의.
  acceptTerms: true,
  acceptPrivacy: true,
};

/**
 * supertest agent의 Set-Cookie 헤더에서 특정 쿠키 값을 뽑아낸다.
 *
 * @param {string[] | undefined} setCookie
 * @param {string} name
 * @returns {string | null}
 */
export const readCookie = (setCookie, name) => {
  if (!setCookie) return null;
  const hit = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!hit) return null;
  return hit.split(';')[0].split('=')[1];
};

/**
 * `/api/signup` 헬퍼. 기본 payload + overrides.
 *
 * @param {import('express').Express} app
 * @param {Record<string, unknown>} [overrides]
 */
export const signupOk = async (app, overrides = {}) => {
  const body = { ...VALID_SIGNUP, ...overrides };
  const res = await request(app).post('/api/signup').send(body);
  return res;
};
