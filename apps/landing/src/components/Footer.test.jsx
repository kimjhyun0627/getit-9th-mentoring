import { ThemeProvider } from '@getit/theme';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../App.jsx';

// #233 — git log 5건은 빌드/런타임 환경에 따라 변할 수 있으므로 테스트는 결정론적 모킹.
vi.mock('../data/git-log.js', () => ({
  getGitLog: () => [
    { sha: 'a1b2c3d', message: 'feat: test fixture 1' },
    { sha: 'b2c3d4e', message: 'feat: test fixture 2' },
    { sha: 'c3d4e5f', message: 'feat: test fixture 3' },
    { sha: 'd4e5f6a', message: 'feat: test fixture 4' },
    { sha: 'e5f6a1b', message: 'feat: test fixture 5' },
  ],
}));

/**
 * Footer 단위 가드 — App.test.jsx 에서 이전 (#351 CR 300-line 가이드).
 * Header (#343 / #246) 의 useSession fetch 가 mount 시 발화하므로 같은 fetch
 * stub 패턴을 공유한다 (401 → 비로그인 안정화).
 */
let originalFetch;
beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: 'Unauthorized' }),
  });
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

const renderApp = () =>
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );

describe('Footer git log (#233)', () => {
  it('Footer에 git log 시그니처가 노출되고 5건 라인을 렌더한다', () => {
    renderApp();
    const log = screen.getByTestId('footer-git-log');
    expect(log).toBeInTheDocument();
    const lines = within(log).getAllByTestId('footer-git-log-line');
    expect(lines).toHaveLength(5);
  });

  it('각 라인이 7자 sha + 메시지 패턴을 따른다 (빌드타임 주입 형식)', () => {
    renderApp();
    const log = screen.getByTestId('footer-git-log');
    const lines = within(log).getAllByTestId('footer-git-log-line');
    for (const line of lines) {
      expect(line.textContent).toMatch(/^[0-9a-f]{7}\s+\S/);
    }
  });
});

describe('Footer 운영 채널 (#296)', () => {
  it('Footer는 미운영 mailto 대신 notion(또는 contact) 외부 채널만 노출한다', () => {
    renderApp();
    const footer = screen.getByRole('contentinfo');
    const mailLink = within(footer).queryByRole('link', { name: /^mail$/i });
    expect(mailLink).toBeNull();
    // notion 링크는 contact 채널로 유지
    expect(within(footer).getByRole('link', { name: /notion/i })).toBeInTheDocument();
  });
});
