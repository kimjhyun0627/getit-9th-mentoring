import { ThemeProvider } from '@getit/theme';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App.jsx';
import { PROJECTS } from './data/projects.js';

/**
 * Phase 6 deep dive 2차 (#412) — landing P2/P3 통합 가드.
 *
 * 분리 사유 (#351 CR 300-line 가이드): App.test.jsx 가 400+ 줄로 비대해져
 * 새 라운드 (#458 / #463 / #469 / #434 / #451) 의 가드를 별도 파일로 분리.
 *
 * Header (#343 / #246) 가 mount 시 auth /api/me 를 fetch 하므로 같은
 * 401 stub 패턴을 공유 (비로그인 안정화).
 */

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

let originalFetch;
beforeEach(() => {
  originalFetch = global.fetch;
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
  vi.restoreAllMocks();
});

const renderApp = () =>
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );

/**
 * #458 — 섹션 마커 번호 체계 정합성.
 * services=[01], team=[02], about=[03], footer=[04] (문서 순서 = 번호 순서).
 * Tech-Dark 시안의 핵심 시각 자산 `[NN]` mono trace label 신뢰도.
 */
describe('섹션 마커 번호 체계 (#458)', () => {
  it('CardGrid (services) 섹션 마커는 [01] 이다', () => {
    renderApp();
    const section = document.querySelector('section#projects');
    expect(section).not.toBeNull();
    expect(section.textContent).toMatch(/\[01\]\s*services/);
  });

  it('Team 섹션 마커는 [02] 이다', () => {
    renderApp();
    const team = screen.getByTestId('team-section');
    expect(team.textContent).toMatch(/\[02\]\s*team\s*\/\s*timeline/);
  });

  it('About 섹션 마커는 [03] 이다', () => {
    renderApp();
    const about = screen.getByTestId('about-section');
    expect(about.textContent).toMatch(/\[03\]\s*about/);
  });

  it('Footer git log 마커는 [04] 이다', () => {
    renderApp();
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toMatch(/\[04\]/);
  });

  it('번호가 중복되지 않는다 (각 섹션 마커 정확히 1회 등장)', () => {
    // CR (#493): .toMatch() 는 존재 확인만 — 2회 이상 등장해도 pass.
    //   각 섹션 마커가 정확히 1회 등장하도록 전역 매치 count 검증.
    //   주의: ProjectCard eyebrow `[01]`~`[04]` 도 같은 문자열을 쓰므로
    //   `[NN] <label>` 형태 (services/team/about/git log) 로 한정해 카운팅.
    renderApp();
    const html = document.body.textContent;
    expect((html.match(/\[01\]\s*services/g) || []).length).toBe(1);
    expect((html.match(/\[02\]\s*team/g) || []).length).toBe(1);
    expect((html.match(/\[03\]\s*about/g) || []).length).toBe(1);
    expect((html.match(/\[04\]\s*git log/g) || []).length).toBe(1);
  });
});

/**
 * #463 — Hero 본문 coder 톤 강화.
 * '작은 제품' → '풀스택 제품' / '플레이그라운드' → '실 운영 모노레포'.
 * About '진짜 프로덕션' 와 톤 정합.
 */
describe('Hero 본문 coder 톤 (#463)', () => {
  it('Hero 본문에 "작은 제품" 자기비하 문구가 더 이상 없다', () => {
    renderApp();
    expect(document.body.textContent).not.toMatch(/작은 제품/);
  });

  it('Hero 본문에 강한 톤 키워드 (풀스택/프로덕션/모노레포) 가 있다', () => {
    renderApp();
    expect(document.body.textContent).toMatch(/풀스택 제품|프로덕션|모노레포/);
  });
});

/**
 * #469 — Hero CTA `git remote` 라벨 → coder 톤 + Hero `./explore --all` 패턴 정합.
 * `./git remote` 로 행위 명시 (./ prefix = 실행 가능).
 */
describe('Hero CTA 라벨 (#469)', () => {
  it('Hero GitHub CTA 라벨은 ./git remote 패턴 (./explore --all 와 정합)', () => {
    renderApp();
    const remote = screen.getByRole('link', { name: /GitHub 저장소/ });
    expect(remote.textContent).toMatch(/\.\/git remote/);
  });
});

/**
 * #434 — ProjectCard 4 액센트 mono SVG glyph (이모지 폐기).
 * favicon/og 와 같은 stroke-based 24×24 line-art, currentColor 상속.
 */
describe('ProjectCard SVG glyph (#434)', () => {
  it('4 카드 모두 mono SVG glyph 를 갖는다 (이모지 박스 미사용)', () => {
    renderApp();
    for (const project of PROJECTS) {
      const heading = screen.getByRole('heading', { name: new RegExp(project.title) });
      const link = heading.closest('a');
      expect(link).not.toBeNull();
      const svg = link.querySelector('svg[aria-hidden="true"]');
      expect(svg).not.toBeNull();
    }
  });

  it('PROJECTS 데이터에 emoji 필드가 더 이상 없다', () => {
    for (const project of PROJECTS) {
      expect(project.emoji).toBeUndefined();
    }
  });
});

/**
 * #451 — sticky 헤더 anchor jump scroll-margin-top.
 * 4 섹션 (id=projects/team/about) 클릭 시 헤더 가림 회피.
 * index.css 의 global `:where(section[id]) { scroll-margin-top }` 으로 처리.
 */
describe('섹션 scroll-margin-top (#451)', () => {
  it('id 가 있는 section 들이 모두 존재한다 (anchor jump 대상)', () => {
    renderApp();
    expect(document.querySelector('section#projects')).not.toBeNull();
    expect(document.querySelector('section#team')).not.toBeNull();
    expect(document.querySelector('section#about')).not.toBeNull();
  });
});
