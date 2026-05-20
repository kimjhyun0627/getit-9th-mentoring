import { ThemeProvider } from '@getit/theme';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App.jsx';
import { PROJECTS } from './data/projects.js';

// Header (#343 / #246) 가 mount 시 auth /api/me 를 fetch 한다.
// 기존 App.test 는 세션 분기와 무관한 카드/Hero/Footer 가드 → 401 로 강제해
// 항상 비로그인(sign in CTA) 경로로 안정화.
//
// CR feedback (#351): `global.fetch` 직접 대입은 `vi.restoreAllMocks()` 로 원복
// 안 됨. originalFetch 캡처 + afterEach 에서 명시적 복구.
let originalFetch;
beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: 'Unauthorized' }),
  });
  // #361 — 온보딩 챗봇이 항상 첫 방문 상태로 시작하지 않도록 clear.
  //   describe 들이 dialog/role 충돌을 일으키지 않게 글로벌 clear.
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

// #233 — git log 5건은 빌드/런타임 환경에 따라 변할 수 있으므로 테스트는 결정론적 모킹.
vi.mock('./data/git-log.js', () => ({
  getGitLog: () => [
    { sha: 'a1b2c3d', message: 'feat: test fixture 1' },
    { sha: 'b2c3d4e', message: 'feat: test fixture 2' },
    { sha: 'c3d4e5f', message: 'feat: test fixture 3' },
    { sha: 'd4e5f6a', message: 'feat: test fixture 4' },
    { sha: 'e5f6a1b', message: 'feat: test fixture 5' },
  ],
}));

/**
 * Tech-Dark 시안 구현 가드 테스트 (Issue #24).
 * - 시멘틱: heading + listitem + banner
 * - 카드 4개 + 색 분배 (cyan/magenta/lime/amber)
 * - mono 헤드라인 + caret + 4-up metaline
 * - 다크 토글 + Sign in 진입점
 */

const renderApp = () =>
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );

describe('App (landing · Tech-Dark)', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('헤더에 GETIT 9기 홈 링크와 mono 로고가 존재한다', () => {
    renderApp();
    const banner = screen.getByRole('banner');
    expect(within(banner).getByLabelText('GETIT 9기 홈')).toBeInTheDocument();
    expect(within(banner).getByText('GETIT')).toBeInTheDocument();
  });

  it('4개 프로젝트 카드를 모두 렌더한다 (h3)', () => {
    renderApp();
    const titles = ['취미메이트', '스마트 서재', '팀 칸반', '익명 롤링페이퍼'];
    for (const title of titles) {
      const heading = screen.getByRole('heading', { level: 3, name: new RegExp(title) });
      expect(heading).toBeInTheDocument();
      const link = heading.closest('a');
      expect(link).not.toBeNull();
    }
  });

  it('ThemeToggle 버튼이 aria-label과 함께 존재한다', () => {
    renderApp();
    const toggle = screen.getByRole('button', { name: /다크모드로 전환|라이트모드로 전환/ });
    expect(toggle).toBeInTheDocument();
  });

  it('카드 그리드에 aria-label "프로젝트 목록"이 존재한다', () => {
    renderApp();
    expect(screen.getByRole('list', { name: '프로젝트 목록' })).toBeInTheDocument();
  });

  it('각 카드 링크가 올바른 href + 새 탭(_blank) + rel noopener 를 갖는다 (#360)', () => {
    renderApp();
    for (const project of PROJECTS) {
      const heading = screen.getByRole('heading', { name: new RegExp(project.title) });
      const link = heading.closest('a');
      expect(link).not.toBeNull();
      expect(link).toHaveAttribute('href', project.href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toMatch(/noopener/);
      expect(link.getAttribute('rel')).toMatch(/noreferrer/);
      expect(link).toHaveAccessibleName(new RegExp(`${project.title}.*새 탭에서 열림`));
    }
  });

  it('각 카드 링크가 외부 링크 시각 인디케이터를 노출한다 (#360 + #284)', () => {
    renderApp();
    for (const project of PROJECTS) {
      const heading = screen.getByRole('heading', { name: new RegExp(project.title) });
      const link = heading.closest('a');
      expect(within(link).getByTestId('external-link-indicator')).toBeInTheDocument();
    }
  });

  it('각 카드 링크가 자기 액센트(data-accent)를 갖는다 (cyan/magenta/lime/amber)', () => {
    renderApp();
    for (const project of PROJECTS) {
      const heading = screen.getByRole('heading', { name: new RegExp(project.title) });
      const link = heading.closest('a');
      expect(link).toHaveAttribute('data-accent', project.accent);
    }
  });

  it('Hero eyebrow 도트 노드가 존재한다 (data-testid="eyebrow-dot")', () => {
    renderApp();
    expect(screen.getByTestId('eyebrow-dot')).toBeInTheDocument();
  });

  it('Footer에 © GETIT 9기 카피라이트 + github/notion 링크가 노출된다 (#296 mail 제거)', () => {
    renderApp();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText(/© GETIT 9기 멘토링/)).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: /github/i })).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: /notion/i })).toBeInTheDocument();
  });

  it('PROJECTS 데이터 4개와 카드 그리드 항목 수가 일치한다', () => {
    renderApp();
    const list = screen.getByRole('list', { name: '프로젝트 목록' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(PROJECTS.length);
    expect(items).toHaveLength(4);
  });

  it('테마 토글 클릭 시 documentElement에 .dark 클래스가 적용된다', async () => {
    renderApp();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    const toggle = screen.getByRole('button', { name: /다크모드로 전환/ });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });
});

describe('Hero (#24)', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });

  it('Hero 4-up metaline이 projects/subdomains/sso/source 4 항목을 모두 렌더한다', () => {
    renderApp();
    const dl = screen.getByTestId('hero-meta');
    expect(dl).toBeInTheDocument();
    for (const label of ['projects', 'subdomains', 'sso', 'source']) {
      expect(within(dl).getByText(label)).toBeInTheDocument();
    }
    expect(within(dl).getByText('04')).toBeInTheDocument();
    expect(within(dl).getByText('05')).toBeInTheDocument();
    expect(within(dl).getByText('unified')).toBeInTheDocument();
    expect(within(dl).getByText('100% open')).toBeInTheDocument();
  });

  it('Hero CTA 두 개 (./explore --all → #projects, git remote → GitHub)', () => {
    renderApp();
    const explore = screen.getByRole('link', { name: /전체 프로젝트 보기/ });
    const remote = screen.getByRole('link', { name: /GitHub 저장소/ });
    expect(explore).toHaveAttribute('href', '#projects');
    expect(remote).toHaveAttribute('href', expect.stringContaining('github.com'));
    expect(remote).toHaveAttribute('target', '_blank');
    expect(remote).toHaveAccessibleName(/새 탭에서 열림/);
  });

  it('Hero에 blink caret 노드가 존재한다 (data-testid="hero-caret")', () => {
    renderApp();
    const caret = screen.getByTestId('hero-caret');
    expect(caret).toBeInTheDocument();
    expect(caret.className).toMatch(/caret/);
  });

  it('Hero meta strip이 region/build/stage 메타를 노출한다', () => {
    renderApp();
    const strip = screen.getByTestId('hero-meta-strip');
    expect(within(strip).getByText('~/getit/9')).toBeInTheDocument();
    expect(within(strip).getByText(/region: knu/i)).toBeInTheDocument();
    expect(within(strip).getByText(/build: 2026.05/i)).toBeInTheDocument();
  });
});

// Header nav + Sign in 가드는 Header.test.jsx 로 이전 (#351 CR 300-line 가이드).

describe('About 섹션 (#24)', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });

  it('About 섹션이 id="about" + heading을 가진다', () => {
    renderApp();
    const about = screen.getByTestId('about-section');
    expect(about).toBeInTheDocument();
    expect(about).toHaveAttribute('id', 'about');
    const heading = within(about).getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
  });
});

describe('CardGrid 앵커 + 2×2 (#24)', () => {
  it('CardGrid 섹션이 id="projects" 앵커를 가진다', () => {
    renderApp();
    const section = document.querySelector('section#projects');
    expect(section).not.toBeNull();
  });
});

// Footer git log 가드는 Footer.test.jsx 로 이전 (#351 CR 300-line 가이드).

// Header status + a11y 가드는 Header.test.jsx 로 이전 (#351 CR 300-line 가이드).

describe('Hero CTA 모바일 stack (#256)', () => {
  it('Hero CTA 컨테이너가 모바일에서 column stack, sm+ 에서 row 로 전환된다', () => {
    renderApp();
    const explore = screen.getByRole('link', { name: /전체 프로젝트 보기/ });
    const container = explore.parentElement;
    expect(container.className).toMatch(/flex-col/);
    expect(container.className).toMatch(/sm:flex-row/);
  });

  it('Hero primary CTA가 모바일에서 w-full, sm+ 에서 w-auto 너비를 갖는다', () => {
    renderApp();
    const explore = screen.getByRole('link', { name: /전체 프로젝트 보기/ });
    expect(explore.className).toMatch(/w-full/);
    expect(explore.className).toMatch(/sm:w-auto/);
  });
});

describe('CardGrid 2x2 반응형 (#240)', () => {
  it('카드 그리드는 sm+ 부터 2 col 이상이다 (모바일 1x4 톤 붕괴 방지)', () => {
    renderApp();
    const list = screen.getByRole('list', { name: '프로젝트 목록' });
    expect(list.className).toMatch(/sm:grid-cols-2/);
  });
});

describe('외부 링크 시각 표시 (#284)', () => {
  it('Hero git remote 링크에 외부 링크 인디케이터가 노출된다', () => {
    renderApp();
    const remote = screen.getByRole('link', { name: /GitHub 저장소/ });
    expect(within(remote).getByTestId('external-link-indicator')).toBeInTheDocument();
  });

  it('Footer github / notion 링크에 외부 링크 인디케이터가 노출된다', () => {
    renderApp();
    const footer = screen.getByRole('contentinfo');
    const github = within(footer).getByRole('link', { name: /github/i });
    const notion = within(footer).getByRole('link', { name: /notion/i });
    expect(within(github).getByTestId('external-link-indicator')).toBeInTheDocument();
    expect(within(notion).getByTestId('external-link-indicator')).toBeInTheDocument();
  });
});

// Footer 운영 채널 가드는 Footer.test.jsx 로 이전 (#351 CR 300-line 가이드).

describe('Team / Timeline 섹션 (#222)', () => {
  it('새 [02] team 섹션이 stat strip을 노출한다', () => {
    renderApp();
    const team = screen.getByTestId('team-section');
    expect(team).toBeInTheDocument();
    expect(team).toHaveAttribute('id', 'team');
    const stats = within(team).getAllByTestId('team-stat');
    expect(stats.length).toBeGreaterThanOrEqual(3);
  });

  it('team 섹션 헤더가 멘토/멘티/일정 키워드를 명시한다', () => {
    renderApp();
    const team = screen.getByTestId('team-section');
    const heading = within(team).getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toMatch(/멘토/);
    expect(heading.textContent).toMatch(/멘티/);
    expect(heading.textContent).toMatch(/일정/);
  });
});

// ThemeToggle SVG 가드는 Header.test.jsx 로 이전 (#351 CR 300-line 가이드).
