import { ThemeProvider } from '@getit/theme';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './App.jsx';
import { PROJECTS } from './data/projects.js';

/**
 * Minimalist 시안 1:1 구현 가드 테스트.
 * Issue #3 — TDD: Red → Green → Refactor.
 * Issue #6 + #8 — Hero polish + Header nav + About 섹션 + Sign in + ThemeToggle SVG.
 */

const renderApp = () =>
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );

describe('App (landing · Minimalist 1:1)', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('헤더에 "GETIT 9기" 텍스트를 렌더한다', () => {
    renderApp();
    expect(screen.getByText('GETIT 9기')).toBeInTheDocument();
  });

  it('4개 프로젝트 카드를 모두 렌더한다', () => {
    renderApp();
    const titles = ['취미메이트', '스마트 서재', '팀 칸반', '익명 롤링페이퍼'];
    for (const title of titles) {
      // 카드 제목 h3은 "{title} — 새 탭에서 열림" (sr-only) accessible name. partial 매치.
      expect(screen.getByRole('heading', { name: new RegExp(title) })).toBeInTheDocument();
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

  it('각 카드 링크가 올바른 href + target=_blank + rel=noopener noreferrer 를 갖는다', () => {
    renderApp();
    for (const project of PROJECTS) {
      // 제목 + sr-only "새 탭에서 열림" 이 accessible name에 포함됨 (정규식 partial match).
      const heading = screen.getByRole('heading', { name: new RegExp(project.title) });
      const link = heading.closest('a');
      expect(link).not.toBeNull();
      expect(link).toHaveAttribute('href', project.href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    }
  });

  it('Hero eyebrow 인디고 도트 노드가 존재한다 (data-testid="eyebrow-dot")', () => {
    renderApp();
    const dot = screen.getByTestId('eyebrow-dot');
    expect(dot).toBeInTheDocument();
  });

  it('Footer에 카피라이트가 노출된다', () => {
    renderApp();
    expect(screen.getByText(/© GETIT 9기 멘토링/)).toBeInTheDocument();
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

describe('Hero polish (#8)', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });

  it('Hero 메타라인 <dl>이 4개 항목 (Projects/Cohort/SSO/Domain) 을 모두 렌더한다', () => {
    renderApp();
    const dl = screen.getByTestId('hero-meta');
    expect(dl).toBeInTheDocument();
    expect(within(dl).getByText('Projects')).toBeInTheDocument();
    expect(within(dl).getByText('Cohort')).toBeInTheDocument();
    expect(within(dl).getByText('SSO')).toBeInTheDocument();
    expect(within(dl).getByText('Domain')).toBeInTheDocument();
    expect(within(dl).getByText('04')).toBeInTheDocument();
    expect(within(dl).getByText('9th')).toBeInTheDocument();
    expect(within(dl).getByText('Unified')).toBeInTheDocument();
    expect(within(dl).getByText('get-it.cloud')).toBeInTheDocument();
  });

  it('Hero CTA 두 개 (프로젝트 보기 → #projects, 9기 소개 → #about) 가 존재한다', () => {
    renderApp();
    const primary = screen.getByRole('link', { name: /프로젝트 보기/ });
    const secondary = screen.getByRole('link', { name: /9기 소개/ });
    expect(primary).toHaveAttribute('href', '#projects');
    expect(secondary).toHaveAttribute('href', '#about');
  });

  it('Hero에 dot-grid 배경 노드가 존재한다 (data-testid="hero-dot-grid")', () => {
    renderApp();
    const grid = screen.getByTestId('hero-dot-grid');
    expect(grid).toBeInTheDocument();
    expect(grid.className).toMatch(/dot-grid/);
  });
});

describe('Header nav + Sign in (#6)', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });

  it('Header 좌측 nav (Projects, About) 링크가 앵커를 가진다', () => {
    renderApp();
    const header = screen.getByRole('banner');
    const projectsNav = within(header).getByRole('link', { name: /Projects/ });
    const aboutNav = within(header).getByRole('link', { name: /About/ });
    expect(projectsNav).toHaveAttribute('href', '#projects');
    expect(aboutNav).toHaveAttribute('href', '#about');
  });

  it('Header 우측 Sign in 링크가 auth.get-it.cloud 로 향한다', () => {
    renderApp();
    const header = screen.getByRole('banner');
    const signIn = within(header).getByRole('link', { name: /Sign in/i });
    expect(signIn).toHaveAttribute('href', expect.stringContaining('auth.get-it.cloud'));
  });
});

describe('About 섹션 (#6)', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });

  it('About 섹션 (data-testid="about-section") 이 렌더된다 + id="about" 앵커를 가진다', () => {
    renderApp();
    const about = screen.getByTestId('about-section');
    expect(about).toBeInTheDocument();
    expect(about).toHaveAttribute('id', 'about');
  });

  it('About 섹션이 H2 제목을 가진다', () => {
    renderApp();
    const about = screen.getByTestId('about-section');
    const heading = within(about).getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
  });
});

describe('CardGrid 앵커', () => {
  it('CardGrid 섹션이 id="projects" 앵커를 가진다', () => {
    renderApp();
    const section = document.querySelector('section#projects');
    expect(section).not.toBeNull();
  });
});

describe('ThemeToggle SVG (#8)', () => {
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
