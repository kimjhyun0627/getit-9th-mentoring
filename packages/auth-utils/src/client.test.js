/**
 * client.js — installSilentRefresh / redirectToLogin / logout 가드 (Issue #241).
 */
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installSilentRefresh, logout, redirectToLogin } from './client.js';

const AUTH_ORIGIN = 'https://auth.test.local';

/**
 * 가짜 axios — interceptor 만 정확히 흉내내는 최소 구현. 실 HTTP 안 함.
 * 401 응답 후 retry 동작을 결정적으로 검증하기 위해 사용.
 *
 * @param {(config: any) => Promise<{ ok: true, data?: any } | { ok: false, status: number }>} responder
 */
const makeFakeAxios = (responder) => {
  /** @type {Array<{ fulfilled: (r: any) => any, rejected: (e: any) => any }>} */
  const responseInterceptors = [];
  const instance = {
    interceptors: {
      response: {
        use: (fulfilled, rejected) => {
          const item = { fulfilled, rejected };
          responseInterceptors.push(item);
          return responseInterceptors.length - 1;
        },
        eject: (id) => {
          responseInterceptors[id] = { fulfilled: (r) => r, rejected: (e) => Promise.reject(e) };
        },
      },
    },
    request: async (config) => {
      // responder 가 { ok: true } | { status: 401 } 등을 결정
      const decision = await responder(config);
      if (decision.ok) {
        let res = { status: 200, data: decision.data ?? null, config };
        for (const i of responseInterceptors) res = i.fulfilled(res);
        return res;
      }
      let err = {
        response: { status: decision.status },
        config,
        message: `HTTP ${decision.status}`,
      };
      for (const i of responseInterceptors) {
        try {
          const handled = await i.rejected(err);
          // 인터셉터가 response 객체를 반환하면 (retry 성공) success path 로 합류.
          return handled;
        } catch (next) {
          err = next;
        }
      }
      throw err;
    },
  };
  return instance;
};

describe('redirectToLogin', () => {
  let originalLoc;
  beforeEach(() => {
    originalLoc = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: 'https://hobby.get-it.cloud/feed' },
    });
  });
  afterEach(() => {
    if (originalLoc) Object.defineProperty(window, 'location', originalLoc);
  });

  it('현재 URL 을 ?redirect= 로 인코딩해서 authOrigin/login 으로 이동', () => {
    redirectToLogin(AUTH_ORIGIN);
    expect(window.location.href).toBe(
      `${AUTH_ORIGIN}/login?redirect=${encodeURIComponent('https://hobby.get-it.cloud/feed')}`,
    );
  });
});

describe('installSilentRefresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('잘못된 axios 인스턴스면 throw', () => {
    expect(() => installSilentRefresh({}, { authOrigin: AUTH_ORIGIN })).toThrow();
  });

  it('authOrigin 미지정이면 throw', () => {
    const instance = axios.create();
    expect(() => installSilentRefresh(instance, {})).toThrow();
    expect(() => installSilentRefresh(instance, { authOrigin: '' })).toThrow();
  });

  it('200 응답은 그대로 통과', async () => {
    const instance = makeFakeAxios(async () => ({ ok: true, data: { foo: 1 } }));
    installSilentRefresh(instance, { authOrigin: AUTH_ORIGIN });
    const res = await instance.request({ url: '/api/me' });
    expect(res.status).toBe(200);
  });

  it('401 → refresh 성공 → 원 요청 retry', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    let attempt = 0;
    const instance = makeFakeAxios(async (config) => {
      // 첫 번째 호출은 401, retry 시점에는 200.
      if (config.url === '/api/posts' && !config._retry_done) {
        config._retry_done = true;
        return { ok: false, status: 401 };
      }
      return { ok: true, data: { id: ++attempt } };
    });
    installSilentRefresh(instance, { authOrigin: AUTH_ORIGIN });
    const res = await instance.request({ url: '/api/posts' });
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${AUTH_ORIGIN}/api/refresh`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('refresh 실패하면 onUnauthorized 콜백 실행 + 원 401 reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401 });
    const onUnauthorized = vi.fn();
    const instance = makeFakeAxios(async () => ({ ok: false, status: 401 }));
    installSilentRefresh(instance, { authOrigin: AUTH_ORIGIN, onUnauthorized });
    await expect(instance.request({ url: '/api/me' })).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('동시 401 N개 → refresh 는 단 1회만 (single-flight)', async () => {
    let refreshCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      refreshCount++;
      // 약간 지연시켜 동시성을 강제
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { ok: true, status: 200 };
    });
    const seen = new Set();
    const instance = makeFakeAxios(async (config) => {
      // 첫 시도 401, retry 시 200.
      if (!seen.has(config.url)) {
        seen.add(config.url);
        return { ok: false, status: 401 };
      }
      return { ok: true, data: { url: config.url } };
    });
    installSilentRefresh(instance, { authOrigin: AUTH_ORIGIN });
    await Promise.all([
      instance.request({ url: '/api/a' }),
      instance.request({ url: '/api/b' }),
      instance.request({ url: '/api/c' }),
    ]);
    expect(refreshCount).toBe(1);
  });

  it('refresh 경로 자체의 401 은 retry 안 함 (무한 루프 방지)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401 });
    const onUnauthorized = vi.fn();
    const instance = makeFakeAxios(async () => ({ ok: false, status: 401 }));
    installSilentRefresh(instance, { authOrigin: AUTH_ORIGIN, onUnauthorized });
    await expect(instance.request({ url: '/api/refresh' })).rejects.toBeDefined();
    // refresh-call 자체였으니 fetch 도 호출 안 됨.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('cleanup() 호출 후엔 인터셉터 동작 안 함', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    const onUnauthorized = vi.fn();
    const instance = makeFakeAxios(async () => ({ ok: false, status: 401 }));
    const cleanup = installSilentRefresh(instance, { authOrigin: AUTH_ORIGIN, onUnauthorized });
    cleanup();
    await expect(instance.request({ url: '/api/me' })).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('logout', () => {
  let originalLoc;
  beforeEach(() => {
    originalLoc = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: 'https://hobby.get-it.cloud/feed' },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    if (originalLoc) Object.defineProperty(window, 'location', originalLoc);
    vi.restoreAllMocks();
  });

  it('logout 은 /api/logout POST 후 로그인으로 리다이렉트', async () => {
    await logout(AUTH_ORIGIN);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${AUTH_ORIGIN}/api/logout`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(window.location.href).toContain(`${AUTH_ORIGIN}/login?redirect=`);
  });
});
