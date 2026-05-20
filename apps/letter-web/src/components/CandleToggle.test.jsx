import { ThemeProvider, useTheme } from '@getit/theme';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CandleToggle } from './CandleToggle.jsx';

/**
 * CandleToggle TDD 가드 (Issue #178).
 *
 * Acceptance:
 *  1. role=switch + 고정 aria-label + aria-checked 가 다크 상태를 반영한다
 *  2. 클릭 → useTheme.resolved 가 토글된다
 *  3. 키보드 (Space) → 토글
 *  4. flicker/glow SVG 영역은 aria-hidden (시각 전용)
 *  5. 필수 internal 클래스(candle-toggle)는 className override 시에도 보존
 */

const LABEL = '다크 모드 토글 (양초)';

const renderToggle = (props) =>
  render(
    <ThemeProvider>
      <CandleToggle {...props} />
    </ThemeProvider>,
  );

describe('CandleToggle', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    useTheme.setState({ preference: 'light', resolved: 'light' });
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('라이트 모드면 role=switch + aria-checked=false', () => {
    renderToggle();
    const sw = screen.getByRole('switch', { name: LABEL });
    expect(sw).toBeInTheDocument();
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAttribute('data-lit', 'false');
  });

  it('클릭하면 다크로 전환 — aria-checked=true', async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole('switch'));

    expect(useTheme.getState().resolved).toBe('dark');
    const sw = screen.getByRole('switch', { name: LABEL });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toHaveAttribute('data-lit', 'true');
  });

  it('키보드 Space 로도 토글된다', async () => {
    const user = userEvent.setup();
    renderToggle();

    const sw = screen.getByRole('switch');
    sw.focus();
    await user.keyboard(' ');

    expect(useTheme.getState().resolved).toBe('dark');
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('두 번 토글 → 라이트로 복귀', async () => {
    const user = userEvent.setup();
    renderToggle();

    const sw = screen.getByRole('switch');
    await user.click(sw);
    await user.click(sw);

    expect(useTheme.getState().resolved).toBe('light');
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('내부 SVG는 aria-hidden 으로 스크린리더에 노출되지 않는다', () => {
    renderToggle();
    const sw = screen.getByRole('switch');
    const svg = sw.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('외부 className 을 줘도 필수 internal 클래스(candle-toggle)는 보존된다', () => {
    renderToggle({ className: 'bg-white shadow-sm' });
    const sw = screen.getByRole('switch');
    // 외관 오버라이드는 적용
    expect(sw.className).toContain('bg-white');
    expect(sw.className).toContain('shadow-sm');
    // 필수 internal 은 보존 (data-lit glow box-shadow의 셀렉터 의존)
    expect(sw.className).toContain('candle-toggle');
    expect(sw.className).toContain('inline-flex');
  });
});
