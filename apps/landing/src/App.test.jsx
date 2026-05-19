import { ThemeProvider } from '@getit/theme';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './App.jsx';
import { PROJECTS } from './data/projects.js';

/**
 * Minimalist 시안 1:1 구현 가드 테스트.
 * Issue #3 — TDD: Red → Green → Refactor.
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
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
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
      const heading = screen.getByRole('heading', { name: project.title });
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
