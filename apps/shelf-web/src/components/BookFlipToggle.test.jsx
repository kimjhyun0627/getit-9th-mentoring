import { useTheme } from '@getit/theme';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';

import { BookFlipToggle } from './BookFlipToggle.jsx';

/**
 * BookFlipToggle (Editorial · 책 페이지 3D flip) — 동작/접근성 계약.
 *
 * 시각 효과(rotateY, perspective)는 jsdom으로 검증 불가 — CSS 회귀는
 * 시안(`docs/design/shelf/editorial.html`) 및 수동 점검에 위임.
 */
describe('BookFlipToggle', () => {
  beforeEach(() => {
    // 각 케이스 격리 — store 는 모듈 싱글톤이라 명시 리셋 필요.
    useTheme.getState().setPreference('light');
  });

  it('role="switch" + 다크 OFF 상태에서 aria-checked=false', () => {
    render(<BookFlipToggle />);
    const sw = screen.getByRole('switch', { name: /다크모드/ });
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('클릭하면 다크로 토글 + aria-checked=true', async () => {
    const user = userEvent.setup();
    render(<BookFlipToggle />);
    const sw = screen.getByRole('switch');
    await user.click(sw);
    expect(useTheme.getState().resolved).toBe('dark');
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('Space 키로도 토글된다 (키보드 a11y)', async () => {
    const user = userEvent.setup();
    render(<BookFlipToggle />);
    const sw = screen.getByRole('switch');
    sw.focus();
    await user.keyboard(' ');
    expect(useTheme.getState().resolved).toBe('dark');
  });

  it('Enter 키로도 토글된다 (키보드 a11y)', async () => {
    const user = userEvent.setup();
    render(<BookFlipToggle />);
    const sw = screen.getByRole('switch');
    sw.focus();
    await user.keyboard('{Enter}');
    expect(useTheme.getState().resolved).toBe('dark');
  });

  /**
   * #260 — prefers-reduced-motion 시 즉시 스왑 가드.
   *
   * jsdom 은 CSS @media 를 실제로 평가하지 않는다. 대신 contract:
   *  - reduced-motion CSS 가 `book-flip-card` 의 transition/transform 을 0 로 무력화하고,
   *    뒷면을 `display: none` 으로 가린다.
   *  - JSX 는 상태와 무관하게 두 면(`book-flip-face--front/back`)을 항상 렌더링.
   * → jsdom 에선 "두 면이 모두 DOM 에 존재하고, 토글 즉시 클래스 `is-dark` 만 바뀐다" 만 검증.
   *   실제 즉시 스왑은 `index.css` 의 reduced-motion 미디어 블록이 책임.
   */
  it('reduced-motion 회귀 가드: 두 면 모두 DOM 에 렌더 + is-dark 클래스 즉시 토글', async () => {
    const user = userEvent.setup();
    render(<BookFlipToggle />);
    const sw = screen.getByRole('switch');
    const card = sw.querySelector('.book-flip-card');
    expect(card).not.toBeNull();
    expect(sw.querySelector('.book-flip-face--front')).not.toBeNull();
    expect(sw.querySelector('.book-flip-face--back')).not.toBeNull();
    expect(card?.classList.contains('is-dark')).toBe(false);
    await user.click(sw);
    expect(card?.classList.contains('is-dark')).toBe(true);
  });
});
