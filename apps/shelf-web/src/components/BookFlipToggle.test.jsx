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
});
