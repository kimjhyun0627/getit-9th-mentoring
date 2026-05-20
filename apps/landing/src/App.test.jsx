import { ThemeProvider } from '@getit/theme';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './App.jsx';
import { PROJECTS } from './data/projects.js';

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

  it('4개 프로젝트 카드를 모두 렌더한다 (h3) — #225 이후 같은 탭이므로 sr-only "새 탭" 제거', () => {
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

  it('각 카드 링크가 올바른 href + 동일 탭(target 비설정 또는 _self)을 갖는다 (#225)', () => {
    renderApp();
    for (const project of PROJECTS) {
      const heading = screen.getByRole('heading', { name: new RegExp(project.title) });
      const link = heading.closest('a');
      expect(link).not.toBeNull();
      expect(link).toHaveAttribute('href', project.href);
      const target = link.getAttribute('target');
      // 같은 SSO 패밀리 — _blank 강제 금지
      expect(target === null || target === '_self').toBe(true);
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

describe('Header nav + Sign in (#24)', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });

  it('Header nav (services, about) 링크가 앵커를 가진다', () => {
    renderApp();
    const header = screen.getByRole('banner');
    const services = within(header).getByRole('link', { name: /프로젝트 섹션으로 이동/ });
    const about = within(header).getByRole('link', { name: /소개 섹션으로 이동/ });
    expect(services).toHaveAttribute('href', '#projects');
    expect(about).toHaveAttribute('href', '#about');
  });

  it('Header Sign in 링크가 auth.get-it.cloud 로 향한다', () => {
    renderApp();
    const header = screen.getByRole('banner');
    const signIn = within(header).getByRole('link', { name: /로그인/ });
    expect(signIn).toHaveAttribute('href', expect.stringContaining('auth.get-it.cloud'));
  });
});

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

describe('Header status + a11y (#261)', () => {
  it('Header "all systems / nominal"에 role="status" + aria-label이 붙는다', () => {
    renderApp();
    const status = screen.getByRole('status', { name: /모든 시스템 정상|all systems/i });
    expect(status).toBeInTheDocument();
  });
});

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
  });
});

describe('ThemeToggle SVG (#24)', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });

  it('ThemeToggle은 이모지가 아닌 인라인 SVG 아이콘을 렌더한다', () => {
    renderApp();
    const toggle = screen.getByRole('button', { name: /다크모드로 전환|라이트모드로 전환/ });
    const svg = toggle.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(toggle.textContent).not.toMatch(/[☀🌙]/u);
  });
});
