import { ThemeProvider } from '@getit/theme';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App.jsx';

/**
 * school-auth #547 — landing 의 `/me` 라우트.
 *
 * 라우팅 전략: react-router-dom 도입 없이 `window.location.pathname` 기반 분기.
 *  - `/` (또는 `/index.html`) → 기존 랜딩 본문 (Hero / CardGrid / Team / About).
 *  - `/me` → MePage.
 *  - 나머지 (`/foo`) → 기존 랜딩 본문 (404 페이지 OOS — nginx SPA fallback 으로 들어옴).
 *
 * vi.mock data/git-log.js — App.test.jsx 와 동일한 결정론적 fixture.
 */

vi.mock('./data/git-log.js', () => ({
  getGitLog: () => [
    { sha: 'a1b2c3d', message: 'feat: test fixture 1' },
    { sha: 'b2c3d4e', message: 'feat: test fixture 2' },
    { sha: 'c3d4e5f', message: 'feat: test fixture 3' },
    { sha: 'd4e5f6a', message: 'feat: test fixture 4' },
    { sha: 'e5f6a1b', message: 'feat: test fixture 5' },
  ],
}));

const renderApp = () =>
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );

const setPath = (pathname) => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      ...window.location,
      pathname,
      origin: 'https://get-it.cloud',
      hash: '',
      search: '',
      href: `https://get-it.cloud${pathname}`,
    },
  });
};

describe('App /me 라우트 mount (school-auth #547)', () => {
  let originalFetch;
  let originalLocation;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalLocation = window.location;
    // 401 → fail-soft 비로그인. /me 페이지가 비로그인 카드를 렌더한다.
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  it('pathname=/me 이면 MePage 본문 ("마이페이지" 헤딩) 을 렌더한다', async () => {
    setPath('/me');
    renderApp();
    await screen.findByRole('heading', { name: /마이페이지/ });
  });

  it('pathname=/ 이면 기존 랜딩 (Hero "9기 멘토링") 을 렌더한다', () => {
    setPath('/');
    renderApp();
    // 마이페이지 본문 헤딩은 없어야 한다.
    expect(screen.queryByRole('heading', { name: /마이페이지/ })).toBeNull();
  });

  it('pathname=/me 이면 기존 CardGrid 가 노출되지 않는다 (회귀: 랜딩 본문은 home 전용)', async () => {
    setPath('/me');
    renderApp();
    await screen.findByRole('heading', { name: /마이페이지/ });
    // CardGrid 의 `[01] services` 헤더가 MePage 에서는 없다.
    // MePage 는 자체 헤더 + 본문만 노출.
    expect(screen.queryByText(/\[01\]/)).toBeNull();
  });
});
