/**
 * GET /api/auth/nickname-suggest — 자동추천 API (Issue #557).
 *
 * 커버리지:
 *  - 200 + `{ suggested: string }` shape
 *  - 닉네임 정규식 통과 (`^[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ\-_]+$`, 2-20자)
 *  - 인증 / CSRF 불필요 (공개)
 *  - DB 충돌 시 숫자 suffix 적용 — 같은 base 만 가능한 mock 으로 검증.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { createApp } from '../src/app.js';
import * as nicknameLib from '../src/lib/nickname.js';

describe('GET /api/auth/nickname-suggest (#557)', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    app = createApp({ rateLimitMax: 1000 });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('200 + suggested 필드 (string, 정규식 통과, 2-20자)', async () => {
    const res = await request(app).get('/api/auth/nickname-suggest');
    expect(res.status).toBe(200);
    expect(typeof res.body.suggested).toBe('string');
    expect(res.body.suggested.length).toBeGreaterThanOrEqual(2);
    expect(res.body.suggested.length).toBeLessThanOrEqual(20);
    expect(res.body.suggested).toMatch(/^[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ\-_]+$/u);
  });

  it('Cache-Control no-store — 추천은 매번 새로 받아야 함', async () => {
    const res = await request(app).get('/api/auth/nickname-suggest');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('인증 미적용 — 쿠키 없이도 200', async () => {
    // CSRF 도 GET 이라 미적용. 익명 호출 가능.
    const res = await request(app).get('/api/auth/nickname-suggest');
    expect(res.status).toBe(200);
  });
});

describe('findAvailableNickname — DB 충돌 시 숫자 suffix (#557, Gemini 최적화)', () => {
  // findMany 기반 mock — base 로 시작하는 모든 닉네임을 한 번에 반환.
  const mkFakeDb = (taken) => ({
    user: {
      findMany: async () => [...taken].map((nickname) => ({ nickname })),
    },
  });

  it('base 가 비어있으면 base 그대로 반환 (findMany 1회)', async () => {
    const spy = vi.fn(async () => []);
    const fakeDb = { user: { findMany: spy } };
    const out = await nicknameLib.findAvailableNickname(fakeDb, () => '느긋한너구리');
    expect(out).toBe('느긋한너구리');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('base 충돌 시 `${base}2` 시도', async () => {
    const out = await nicknameLib.findAvailableNickname(
      mkFakeDb(new Set(['느긋한너구리'])),
      () => '느긋한너구리',
    );
    expect(out).toBe('느긋한너구리2');
  });

  it('base + suffix 2..5 모두 충돌 → suffix 6 반환 (DB 왕복 1회만)', async () => {
    const spy = vi.fn(async () => [
      { nickname: '느긋한너구리' },
      { nickname: '느긋한너구리2' },
      { nickname: '느긋한너구리3' },
      { nickname: '느긋한너구리4' },
      { nickname: '느긋한너구리5' },
    ]);
    const fakeDb = { user: { findMany: spy } };
    const out = await nicknameLib.findAvailableNickname(fakeDb, () => '느긋한너구리');
    expect(out).toBe('느긋한너구리6');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
