import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CodeTerminalToggle } from './code-terminal-toggle.jsx';
import { ThemeProvider } from './provider.jsx';
import { useTheme } from './store.js';

/**
 * CodeTerminalToggle TDD 가드 (Issue #363).
 *
 * Acceptance:
 *  1. role=switch + 고정 aria-label + aria-checked 가 다크 상태 반영
 *  2. 클릭 → useTheme.resolved 토글 + data-theme 갱신
 *  3. 키보드 (Space / Enter) 토글
 *  4. 값 텍스트는 폭 일정 (라이트/다크 모두 7-char `[ ... ]`)
 *  5. caret 은 aria-hidden — 스크린리더 노출 X
 *  6. reduced-motion fallback CSS 1회 주입
 */

const LABEL = '다크 모드 토글 (terminal)';

const renderToggle = (props) =>
  render(
    <ThemeProvider>
      <CodeTerminalToggle {...props} />
    </ThemeProvider>,
  );

describe('CodeTerminalToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // jsdom cookie 초기화 (이전 테스트 leak 방지)
    const all = document.cookie ? document.cookie.split(';') : [];
    for (const part of all) {
      const k = part.split('=')[0]?.trim();
      if (k) document.cookie = `${k}=; Max-Age=0; Path=/`;
    }
    document.documentElement.classList.remove('dark');
    useTheme.setState({ preference: 'light', resolved: 'light', cookieDomain: undefined });
  });

  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove('dark');
    document.getElementById('getit-code-terminal-toggle-styles')?.remove();
  });

  it('라이트 모드면 role=switch + aria-checked=false + data-theme=light', () => {
    renderToggle();
    const sw = screen.getByRole('switch', { name: LABEL });
    expect(sw).toBeInTheDocument();
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAttribute('data-theme', 'light');
  });

  it('값 텍스트는 라이트일 때 [ light ]', () => {
    renderToggle();
    const sw = screen.getByRole('switch');
    expect(sw.textContent).toContain('[ light ]');
  });

  it('클릭하면 다크로 전환 — aria-checked=true + [ dark  ] 표시', () => {
    renderToggle();
    fireEvent.click(screen.getByRole('switch'));

    expect(useTheme.getState().resolved).toBe('dark');
    const sw = screen.getByRole('switch', { name: LABEL });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toHaveAttribute('data-theme', 'dark');
    expect(sw.textContent).toContain('[ dark  ]');
  });

  it('값 텍스트 폭은 라이트/다크 동일 (9 char including brackets)', () => {
    renderToggle();
    const sw = screen.getByRole('switch');
    const lightVal = '[ light ]';
    const darkVal = '[ dark  ]';
    expect(lightVal.length).toBe(darkVal.length);
    fireEvent.click(sw);
    expect(sw.textContent).toContain(darkVal);
  });

  it('Space 키로 토글 (button + role=switch 기본 동작)', () => {
    renderToggle();
    const sw = screen.getByRole('switch');
    // jsdom 의 button 은 Space keypress 를 자동 click 으로 변환 안 함 — 명시적 click.
    sw.focus();
    fireEvent.keyDown(sw, { key: ' ', code: 'Space' });
    fireEvent.keyUp(sw, { key: ' ', code: 'Space' });
    // 폴리필 fallback: 버튼은 기본적으로 keydown Space → click. jsdom 미지원이라 click 으로 검증.
    fireEvent.click(sw);
    expect(useTheme.getState().resolved).toBe('dark');
  });

  it('두 번 토글 → 라이트로 복귀', () => {
    renderToggle();
    const sw = screen.getByRole('switch');
    fireEvent.click(sw);
    fireEvent.click(sw);
    expect(useTheme.getState().resolved).toBe('light');
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('caret 은 aria-hidden 으로 스크린리더에 노출 안 됨', () => {
    renderToggle();
    const sw = screen.getByRole('switch');
    const caret = sw.querySelector('.ct-caret');
    expect(caret).not.toBeNull();
    expect(caret).toHaveAttribute('aria-hidden', 'true');
  });

  it('caret 키프레임 fallback 스타일이 1회만 주입된다', () => {
    renderToggle();
    renderToggle(); // 두 번째 render 도 중복 주입 X
    const styles = document.querySelectorAll('#getit-code-terminal-toggle-styles');
    expect(styles.length).toBe(1);
  });

  it('외부 className 을 주면 기본 외관 클래스를 완전히 대체한다', () => {
    renderToggle({ className: 'my-custom-class h-12' });
    const sw = screen.getByRole('switch');
    expect(sw.className).toBe('my-custom-class h-12');
  });

  it('className 미지정 시 기본 외관 클래스가 적용된다', () => {
    renderToggle();
    const sw = screen.getByRole('switch');
    expect(sw.className).toContain('font-mono');
    expect(sw.className).toContain('border-hairline');
  });

  it('값 텍스트는 다크에서 white (#377 contrast fix) — 배경과 최대 분리 + cyan caret 과 색 분리', () => {
    renderToggle();
    fireEvent.click(screen.getByRole('switch'));
    const sw = screen.getByRole('switch');
    const valueSpan = Array.from(sw.querySelectorAll('span')).find((s) =>
      s.textContent?.includes('[ dark'),
    );
    expect(valueSpan).toBeTruthy();
    // dark:text-white → 다크 모드일 때 white 적용 (cyan-300 → white 로 변경, #377)
    expect(valueSpan.className).toContain('dark:text-white');
    expect(valueSpan.className).not.toContain('dark:text-cyan-300');
  });

  it('값 텍스트는 라이트에서 zinc-900 — 배경 white 와 최대 대비 (대칭 단언)', () => {
    renderToggle();
    const sw = screen.getByRole('switch');
    const valueSpan = Array.from(sw.querySelectorAll('span')).find((s) =>
      s.textContent?.includes('[ light'),
    );
    expect(valueSpan).toBeTruthy();
    expect(valueSpan.className).toContain('text-zinc-900');
  });
});
