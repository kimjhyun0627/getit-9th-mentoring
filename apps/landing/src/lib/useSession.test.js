import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSession } from './useSession.js';

/**
 * #343 / #246 — landing 헤더 SSO 세션 상태 hook.
 *
 * 정책:
 *  - mount 시 auth-api `GET /api/me` 한 번 fetch (credentials: 'include').
 *  - 200 → { user: { sub, email, name } } 노출.
 *  - 401 → 비로그인 (user=null).
 *  - 5xx/네트워크 에러 → fail-soft (조용히 비로그인 표시).
 *  - 로딩 중에는 user=null 이지만 loading=true.
 */

describe('useSession (#343 / #246)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('mount 시 auth /api/me 를 credentials: include 로 호출한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { sub: 'u1', email: 'a@b.com', name: '홍길동' } }),
    });
    global.fetch = fetchMock;

    renderHook(() => useSession());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://auth.get-it.cloud/api/me');
    expect(init).toMatchObject({ credentials: 'include' });
  });

  it('200 응답에서 user 를 노출하고 loading=false 로 떨어진다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { sub: 'u1', email: 'a@b.com', name: '홍길동' } }),
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual({ sub: 'u1', email: 'a@b.com', name: '홍길동' });
  });

  it('401 응답이면 user=null + loading=false (비로그인)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('5xx 응답이면 fail-soft: user=null + loading=false', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'BackendDown' }),
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('네트워크 에러는 fail-soft: user=null + loading=false (console 노이즈 X)', async () => {
    // 네트워크 에러 = BE-down. UI 가 비로그인으로 표시되어야 한다.
    global.fetch = vi.fn().mockRejectedValue(new Error('Network down'));
    // 의도된 fail-soft 라 console.error 도 silence — 테스트 노이즈 차단.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    errSpy.mockRestore();
  });

  it('초기 상태는 loading=true + user=null', () => {
    // fetch 호출은 일어나지만 resolve 는 다음 tick → 동기 시점은 로딩.
    let resolveFetch;
    global.fetch = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { result } = renderHook(() => useSession());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    // cleanup — pending promise resolve
    act(() => {
      resolveFetch({ ok: false, status: 401, json: async () => ({}) });
    });
  });

  it('잘못된 응답 형태(user 필드 없음)는 fail-soft 로 비로그인 처리', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ wrong: 'shape' }),
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });
});
