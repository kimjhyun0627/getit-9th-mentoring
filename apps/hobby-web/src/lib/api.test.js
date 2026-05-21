import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, assertJsonObject, assertListShape, client, refreshAccessToken } from './api.js';

/**
 * BE-down 회복력 검증.
 *
 * vite dev server 가 `/api/posts` 미존재 시 SPA fallback 으로 `index.html`(HTML) 을
 * status 200 으로 응답하는 케이스가 실제 발생함 (issue #89).
 * 응답 검증은 글로벌 axios interceptor 가 처리하고, 호출 측은 react-query 의
 * `isError` 분기로 흘려보내기만 한다.
 */
describe('assertJsonObject — 글로벌 interceptor 검증 로직', () => {
  it('일반 JSON 객체는 통과한다', () => {
    expect(() =>
      assertJsonObject({ items: [] }, { 'content-type': 'application/json' }),
    ).not.toThrow();
  });

  it('content-type 이 text/html 이면 throw (SPA fallback)', () => {
    expect(() =>
      assertJsonObject('<!doctype html>', { 'content-type': 'text/html; charset=utf-8' }),
    ).toThrow(/invalid response/i);
  });

  it('data 가 문자열이면 (content-type 누락이어도) throw', () => {
    expect(() => assertJsonObject('<!doctype html>', {})).toThrow(/invalid response/i);
  });

  it('data 가 null 이면 throw', () => {
    expect(() => assertJsonObject(null, { 'content-type': 'application/json' })).toThrow(
      /invalid response/i,
    );
  });

  it('headers 가 undefined 여도 안전하게 동작한다', () => {
    expect(() => assertJsonObject({ ok: true }, undefined)).not.toThrow();
  });
});

describe('assertListShape — 리스트 응답 shape 검증', () => {
  it('items 가 배열이면 통과한다', () => {
    expect(() => assertListShape({ items: [], nextCursor: null })).not.toThrow();
  });

  it('items 가 없으면 throw', () => {
    expect(() => assertListShape({ foo: 'bar' })).toThrow(/items must be an array/i);
  });

  it('items 가 배열이 아니면 throw', () => {
    expect(() => assertListShape({ items: 'not-an-array' })).toThrow(/items must be an array/i);
  });
});

describe('api.listPosts — 응답 처리', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('정상 JSON 응답은 그대로 통과한다', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({
      data: { items: [], nextCursor: null },
      headers: { 'content-type': 'application/json' },
    });
    await expect(api.listPosts()).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('items 가 누락된 응답은 throw 한다 (리스트 전용 shape 가드)', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({
      data: { foo: 'bar' },
      headers: { 'content-type': 'application/json' },
    });
    await expect(api.listPosts()).rejects.toThrow(/items must be an array/i);
  });
});

/**
 * #402 — access token 만료 후 refresh + 재시도.
 *
 * `refreshAccessToken()` 가 in-flight promise 를 공유해 동시 401 들이 single-fire
 * 인지 검증. 실제 `/api/refresh` 호출 자체는 axios adapter 까지 가지 못하게
 * vi.spyOn 으로 가로채 환경 독립으로 만든다.
 */
describe('refreshAccessToken — 단일 비행 + 동시 401 흡수', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('동시에 호출되어도 동일 in-flight promise 를 공유한다 (single-fire)', async () => {
    // refreshAccessToken 은 내부 refreshClient.post 가 settle 될 때까지 같은
    // promise 를 반환해야 한다. 첫 호출이 완료되기 전에 두 번째 호출이 같은
    // promise 객체를 받는지를 micro-task 순서로 검증.
    const p1 = refreshAccessToken();
    const p2 = refreshAccessToken();
    // settle 되기 직전 (await yield 없이) 두 핸들이 동일 promise.
    expect(p2).toBe(p1);
    // 첫 호출 settle 이후엔 새 호출은 새 promise 가 된다.
    await Promise.allSettled([p1]);
    const p3 = refreshAccessToken();
    expect(p3).not.toBe(p1);
    await Promise.allSettled([p3]);
  });
});
