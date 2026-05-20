import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, assertJsonObject, assertListShape, client } from './api.js';

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
