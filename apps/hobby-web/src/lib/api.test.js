import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, client } from './api.js';

/**
 * BE-down 회복력 검증.
 *
 * vite dev server 가 `/api/posts` 미존재 시 SPA fallback 으로 `index.html`(HTML) 을
 * status 200 으로 응답하는 케이스가 실제 발생함 (issue #89).
 * 이 때 `api.listPosts()` 는 react-query 가 `isError` 로 잡을 수 있게 throw 해야 함.
 */
describe('api.listPosts — invalid response 처리', () => {
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

  it('HTML 문자열을 받으면 throw 한다 (SPA fallback 케이스)', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({
      data: '<!doctype html><html><body>vite</body></html>',
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
    await expect(api.listPosts()).rejects.toThrow(/invalid response/i);
  });

  it('content-type 이 application/json 이어도 shape 이 잘못되면 throw 한다', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({
      data: { foo: 'bar' },
      headers: { 'content-type': 'application/json' },
    });
    await expect(api.listPosts()).rejects.toThrow(/invalid response/i);
  });

  it('items 가 배열이 아니면 throw 한다', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({
      data: { items: 'not-an-array', nextCursor: null },
      headers: { 'content-type': 'application/json' },
    });
    await expect(api.listPosts()).rejects.toThrow(/invalid response/i);
  });

  it('data 가 문자열이면 (content-type 없어도) throw 한다', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({
      data: '<!doctype html>',
      headers: {},
    });
    await expect(api.listPosts()).rejects.toThrow(/invalid response/i);
  });
});
