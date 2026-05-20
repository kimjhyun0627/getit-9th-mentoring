import { ThemeProvider } from '@getit/theme';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Header } from './Header.jsx';

/**
 * #343 / #246 — Header SSO 세션 상태 분기 가드.
 *
 *  - 로딩 → skeleton placeholder (CLS 방지).
 *  - 비로그인 (401/5xx/network/잘못된 응답) → `$ sign in` CTA.
 *  - 로그인 (200 + { user }) → 사용자 이름 + `$ logout` 버튼.
 *  - 로그아웃 클릭 → POST auth/api/logout + reload.
 */

const mockFetchMe = (status, body) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
};

const renderHeader = () =>
  render(
    <ThemeProvider>
      <Header />
    </ThemeProvider>,
  );

describe('Header SSO 세션 분기 (#343 / #246)', () => {
  let originalFetch;
  let originalLocation;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalLocation = window.location;
    document.documentElement.classList.remove('dark');
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

  it('비로그인(401)이면 sign in CTA 를 렌더한다', async () => {
    mockFetchMe(401, { error: 'Unauthorized' });
    renderHeader();
    const cta = await screen.findByTestId('session-signin');
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', expect.stringContaining('auth.get-it.cloud'));
    expect(cta).toHaveAccessibleName(/로그인/);
  });

  it('비로그인 상태에서는 logout 버튼이 노출되지 않는다', async () => {
    mockFetchMe(401, { error: 'Unauthorized' });
    renderHeader();
    await screen.findByTestId('session-signin');
    expect(screen.queryByTestId('session-logout')).toBeNull();
  });

  it('로그인(200 + user)이면 사용자 이름과 logout 버튼을 렌더한다', async () => {
    mockFetchMe(200, { user: { sub: 'u1', email: 'a@b.com', name: '홍길동' } });
    renderHeader();
    const logout = await screen.findByTestId('session-logout');
    expect(logout).toBeInTheDocument();
    expect(logout).toHaveAccessibleName(/로그아웃/);
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.queryByTestId('session-signin')).toBeNull();
  });

  it('user.name 이 없으면 email 을 표시 fallback 으로 쓴다', async () => {
    mockFetchMe(200, { user: { sub: 'u1', email: 'fallback@b.com' } });
    renderHeader();
    await screen.findByTestId('session-logout');
    expect(screen.getByText('fallback@b.com')).toBeInTheDocument();
  });

  it('5xx 응답이면 fail-soft 로 sign in CTA 를 렌더한다', async () => {
    mockFetchMe(503, { error: 'BackendDown' });
    renderHeader();
    await screen.findByTestId('session-signin');
    expect(screen.queryByTestId('session-logout')).toBeNull();
  });

  it('네트워크 에러는 fail-soft 로 sign in CTA 를 렌더한다', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHeader();
    await screen.findByTestId('session-signin');
    errSpy.mockRestore();
  });

  it('로딩 중에는 skeleton placeholder 가 노출되고 두 CTA 모두 미렌더', () => {
    // pending promise — resolve 안 함
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    renderHeader();
    expect(screen.getByTestId('session-cta-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('session-signin')).toBeNull();
    expect(screen.queryByTestId('session-logout')).toBeNull();
  });

  it('useSession fetch 가 credentials: include 로 호출된다 (cross-domain cookie)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    global.fetch = fetchMock;
    renderHeader();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({ credentials: 'include' });
  });

  it('logout 버튼 클릭 시 POST auth/api/logout 호출 후 페이지 reload', async () => {
    // 첫 호출 = /me, 두 번째 = /logout
    const fetchMock = vi.fn();
    // /me 응답
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: { sub: 'u1', name: '홍길동' } }),
    });
    // /logout 응답
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
    global.fetch = fetchMock;

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        reload: reloadMock,
        origin: 'https://get-it.cloud',
        pathname: '/',
        hash: '',
      },
    });

    renderHeader();
    const logout = await screen.findByTestId('session-logout');
    fireEvent.click(logout);

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
    const logoutCall = fetchMock.mock.calls[1];
    expect(logoutCall[0]).toBe('https://auth.get-it.cloud/api/logout');
    expect(logoutCall[1]).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('logout 호출이 실패해도 reload 는 호출된다 (fail-soft)', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: { sub: 'u1', name: '홍길동' } }),
    });
    fetchMock.mockRejectedValueOnce(new Error('logout failed'));
    global.fetch = fetchMock;

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        reload: reloadMock,
        origin: 'https://get-it.cloud',
        pathname: '/',
        hash: '',
      },
    });

    renderHeader();
    const logout = await screen.findByTestId('session-logout');
    fireEvent.click(logout);

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
  });

  it('Tech-Dark 헤더 핵심 요소(로고/nav)는 세션 상태와 무관하게 유지된다', async () => {
    mockFetchMe(200, { user: { sub: 'u1', name: '홍길동' } });
    renderHeader();
    expect(screen.getByLabelText('GETIT 9기 홈')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /프로젝트 섹션으로 이동/ })).toBeInTheDocument();
    await screen.findByTestId('session-logout');
  });
});

/**
 * App.test.jsx 에서 이전됨 — Header 단위 가드는 Header.test.jsx 에 집중 (#351 CR
 * 300-line 가이드 + single responsibility). describe 명/스펙은 그대로.
 */
describe('Header nav + Sign in (#24)', () => {
  beforeEach(() => {
    mockFetchMe(401, { error: 'Unauthorized' });
    document.documentElement.classList.remove('dark');
  });

  it('Header nav (services, about) 링크가 앵커를 가진다', () => {
    renderHeader();
    const services = screen.getByRole('link', { name: /프로젝트 섹션으로 이동/ });
    const about = screen.getByRole('link', { name: /소개 섹션으로 이동/ });
    expect(services).toHaveAttribute('href', '#projects');
    expect(about).toHaveAttribute('href', '#about');
  });
});

describe('Header status + a11y (#261)', () => {
  beforeEach(() => {
    mockFetchMe(401, { error: 'Unauthorized' });
  });

  it('Header "all systems / nominal"에 role="status" + aria-label이 붙는다', () => {
    renderHeader();
    const status = screen.getByRole('status', { name: /모든 시스템 정상|all systems/i });
    expect(status).toBeInTheDocument();
  });
});

describe('ThemeToggle SVG (#24)', () => {
  beforeEach(() => {
    mockFetchMe(401, { error: 'Unauthorized' });
    document.documentElement.classList.remove('dark');
  });

  it('ThemeToggle은 이모지가 아닌 인라인 SVG 아이콘을 렌더한다', () => {
    renderHeader();
    const toggle = screen.getByRole('button', { name: /다크모드로 전환|라이트모드로 전환/ });
    const svg = toggle.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(toggle.textContent).not.toMatch(/[☀🌙]/u);
  });
});
