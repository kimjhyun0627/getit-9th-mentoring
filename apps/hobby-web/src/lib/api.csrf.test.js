/**
 * api.csrf helper 단위 테스트 — #573.
 *
 * - ensureCsrfToken: 첫 호출만 GET /csrf, 캐시 reuse, 실패 swallow → null
 * - makeCsrfRequestInterceptor: 상태변경 메서드에만 헤더 첨부 + GET 은 skip
 * - onCsrfError: 403 Csrf* 응답 → 캐시 무효화 (다음 ensure 가 재발급)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetCsrfForTest,
  clearCsrfTokenCache,
  ensureCsrfToken,
  makeCsrfRequestInterceptor,
  onCsrfError,
} from './api.csrf.js';

const mkInstance = (getImpl) => ({
  get: vi.fn(getImpl),
});

describe('api.csrf', () => {
  beforeEach(() => {
    __resetCsrfForTest();
  });
  afterEach(() => {
    __resetCsrfForTest();
  });

  describe('ensureCsrfToken', () => {
    it('첫 호출에만 GET /csrf — 두 번째는 캐시 reuse', async () => {
      const instance = mkInstance(() => Promise.resolve({ data: { token: 'tok-1' } }));
      const a = await ensureCsrfToken(instance);
      const b = await ensureCsrfToken(instance);
      expect(a).toBe('tok-1');
      expect(b).toBe('tok-1');
      expect(instance.get).toHaveBeenCalledTimes(1);
      expect(instance.get).toHaveBeenCalledWith('/csrf');
    });

    it('GET 실패 시 swallow → null 반환 (요청은 헤더 없이 발사되고 BE 가 403 처리)', async () => {
      const instance = mkInstance(() => Promise.reject(new Error('boom')));
      const t = await ensureCsrfToken(instance);
      expect(t).toBeNull();
    });

    it('응답 body 의 token 이 빈 문자열이면 null', async () => {
      const instance = mkInstance(() => Promise.resolve({ data: { token: '' } }));
      const t = await ensureCsrfToken(instance);
      expect(t).toBeNull();
    });

    it('clearCsrfTokenCache 후엔 다시 GET /csrf 호출', async () => {
      const instance = mkInstance(() => Promise.resolve({ data: { token: 'tok-x' } }));
      await ensureCsrfToken(instance);
      clearCsrfTokenCache();
      await ensureCsrfToken(instance);
      expect(instance.get).toHaveBeenCalledTimes(2);
    });

    it('동시 호출 (single-flight) — 첫 호출만 GET /csrf, 나머지는 같은 promise (#580 Gemini)', async () => {
      let resolveGet;
      const instance = mkInstance(
        () =>
          new Promise((resolve) => {
            resolveGet = () => resolve({ data: { token: 'tok-single' } });
          }),
      );
      // 첫 호출이 settle 되기 전 두 번째/세 번째 동시 발사
      const p1 = ensureCsrfToken(instance);
      const p2 = ensureCsrfToken(instance);
      const p3 = ensureCsrfToken(instance);
      // 셋 다 동일 in-flight promise — race condition 방지
      expect(p2).toBe(p1);
      expect(p3).toBe(p1);
      resolveGet();
      await Promise.all([p1, p2, p3]);
      expect(instance.get).toHaveBeenCalledTimes(1);
    });

    it('실패 후엔 in-flight 해제 — 다음 호출이 즉시 재시도', async () => {
      const instance = mkInstance(() => Promise.reject(new Error('boom')));
      const a = await ensureCsrfToken(instance);
      expect(a).toBeNull();
      // 두 번째 호출은 첫 실패 후의 새 GET — promise 가 해제됐어야 시도됨
      const b = await ensureCsrfToken(instance);
      expect(b).toBeNull();
      expect(instance.get).toHaveBeenCalledTimes(2);
    });

    it('clearCsrfTokenCache 가 진행 중 in-flight 를 깨지 않는다 (CR #580 major)', async () => {
      // GET /csrf 가 settle 되기 전에 clearCsrfTokenCache 호출되어도 같은 promise 가
      // 끝까지 살아남아야 함. 그래야 동시 in-flight 호출자들이 새 GET 을 발사하지 않는다.
      let resolveGet;
      const instance = mkInstance(
        () =>
          new Promise((resolve) => {
            resolveGet = () => resolve({ data: { token: 'tok-inflight' } });
          }),
      );
      const p1 = ensureCsrfToken(instance);
      // settle 전 캐시 무효화 — token 만 비우고 promise 는 보존되어야 함
      clearCsrfTokenCache();
      const p2 = ensureCsrfToken(instance);
      expect(p2).toBe(p1); // 같은 in-flight 공유
      resolveGet();
      await Promise.all([p1, p2]);
      expect(instance.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('makeCsrfRequestInterceptor', () => {
    it('GET 은 헤더 첨부 X + GET /csrf 도 호출 X (불필요한 라운드트립 차단)', async () => {
      const instance = mkInstance(() => Promise.resolve({ data: { token: 't' } }));
      const interceptor = makeCsrfRequestInterceptor(instance);
      const cfg = await interceptor({ method: 'get', headers: {} });
      expect(cfg.headers['X-CSRF-Token']).toBeUndefined();
      expect(instance.get).not.toHaveBeenCalled();
    });

    it('PATCH 는 X-CSRF-Token 헤더 자동 첨부', async () => {
      const instance = mkInstance(() => Promise.resolve({ data: { token: 'tok-patch' } }));
      const interceptor = makeCsrfRequestInterceptor(instance);
      const cfg = await interceptor({ method: 'patch', headers: {} });
      expect(cfg.headers['X-CSRF-Token']).toBe('tok-patch');
    });

    it('POST/PUT/DELETE 모두 헤더 첨부', async () => {
      const instance = mkInstance(() => Promise.resolve({ data: { token: 't' } }));
      const interceptor = makeCsrfRequestInterceptor(instance);
      for (const m of ['post', 'put', 'delete']) {
        __resetCsrfForTest();
        const cfg = await interceptor({ method: m, headers: {} });
        expect(cfg.headers['X-CSRF-Token']).toBe('t');
      }
    });

    it('headers 가 undefined 여도 안전하게 추가', async () => {
      const instance = mkInstance(() => Promise.resolve({ data: { token: 't' } }));
      const interceptor = makeCsrfRequestInterceptor(instance);
      const cfg = await interceptor({ method: 'patch' });
      expect(cfg.headers['X-CSRF-Token']).toBe('t');
    });

    it('GET /csrf 가 실패해도 요청 자체는 그대로 통과 (헤더만 누락)', async () => {
      const instance = mkInstance(() => Promise.reject(new Error('boom')));
      const interceptor = makeCsrfRequestInterceptor(instance);
      const cfg = await interceptor({ method: 'patch', headers: {} });
      expect(cfg.headers['X-CSRF-Token']).toBeUndefined();
    });
  });

  describe('onCsrfError', () => {
    it('403 CsrfTokenMismatch → 캐시 무효화 + reject pass-through', async () => {
      const instance = mkInstance(() => Promise.resolve({ data: { token: 'first' } }));
      await ensureCsrfToken(instance);
      const err = { response: { status: 403, data: { error: 'CsrfTokenMismatch' } } };
      await expect(onCsrfError(err)).rejects.toBe(err);
      // 다음 호출은 다시 GET /csrf
      instance.get.mockResolvedValueOnce({ data: { token: 'second' } });
      const t = await ensureCsrfToken(instance);
      expect(t).toBe('second');
    });

    it('403 이지만 Csrf 코드가 아니면 캐시 유지', async () => {
      const instance = mkInstance(() => Promise.resolve({ data: { token: 'keep' } }));
      await ensureCsrfToken(instance);
      const err = { response: { status: 403, data: { error: 'SchoolNotVerified' } } };
      await expect(onCsrfError(err)).rejects.toBe(err);
      const t = await ensureCsrfToken(instance);
      expect(t).toBe('keep');
      expect(instance.get).toHaveBeenCalledTimes(1);
    });

    it('401/500 등 다른 status 는 캐시 유지', async () => {
      const instance = mkInstance(() => Promise.resolve({ data: { token: 'keep' } }));
      await ensureCsrfToken(instance);
      const err = { response: { status: 401 } };
      await expect(onCsrfError(err)).rejects.toBe(err);
      const t = await ensureCsrfToken(instance);
      expect(t).toBe('keep');
    });

    it('response 없는 network error 도 안전하게 reject', async () => {
      const err = new Error('Network Error');
      await expect(onCsrfError(err)).rejects.toBe(err);
    });
  });
});
