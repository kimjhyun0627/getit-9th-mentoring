import { ThemeProvider } from '@getit/theme';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OnboardingBubble } from './OnboardingBubble.jsx';

/**
 * #361 — 첫 사용자 온보딩 챗봇 가드.
 *   - localStorage 'onboarded' 가 'true' 면 미렌더 (재방문)
 *   - 미설정이면 coder 톤 다이얼로그 + 다크/라이트 토글 힌트 노출
 *   - '이해했어요' 클릭 → localStorage 저장 + 다이얼로그 제거
 *   - 우상단 토글 옆 mini hint arrow 노드 존재
 */

const renderBubble = () =>
  render(
    <ThemeProvider>
      <OnboardingBubble />
    </ThemeProvider>,
  );

describe('OnboardingBubble (#361)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('첫 방문 (localStorage 미설정) 시 coder 톤 챗봇이 렌더된다', () => {
    renderBubble();
    const dialog = screen.getByTestId('onboarding-bubble');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog.textContent).toMatch(/안녕! 처음이지\?/);
    expect(dialog.textContent).toMatch(/다크\/라이트 토글은 우상단에 있어/);
    expect(dialog.textContent).toMatch(/한 번 눌러봐/);
  });

  it('mini hint arrow (토글 위치 가이드) 노드가 존재한다', () => {
    renderBubble();
    expect(screen.getByTestId('onboarding-hint-arrow')).toBeInTheDocument();
  });

  it('"이해했어요" 클릭 시 localStorage 에 onboarded=true 저장 + dismiss', () => {
    renderBubble();
    const btn = screen.getByTestId('onboarding-dismiss');
    fireEvent.click(btn);
    expect(window.localStorage.getItem('onboarded')).toBe('true');
    expect(screen.queryByTestId('onboarding-bubble')).toBeNull();
  });

  it('재방문 (localStorage onboarded=true) 시 미렌더', () => {
    window.localStorage.setItem('onboarded', 'true');
    renderBubble();
    expect(screen.queryByTestId('onboarding-bubble')).toBeNull();
  });

  it('coder 톤 prompt prefix (`>`) 가 본문에 노출된다', () => {
    renderBubble();
    const dialog = screen.getByTestId('onboarding-bubble');
    // aria-hidden 으로 들어간 `>` 도 textContent 에는 포함됨.
    expect(dialog.textContent).toMatch(/>/);
  });
});
