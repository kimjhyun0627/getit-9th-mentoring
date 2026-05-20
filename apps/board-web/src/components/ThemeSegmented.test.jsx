import { useTheme } from '@getit/theme';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeSegmented } from './ThemeSegmented.jsx';

/**
 * 3-state segmented 토글 단위 테스트.
 * - radiogroup + 3 radio (light/auto/dark)
 * - 클릭 시 store preference 갱신 (auto = 'system')
 * - 키보드 ←/→ 로 roving focus
 * - prefers-reduced-motion 환경에서 transition-none 클래스 부여
 */
describe('ThemeSegmented', () => {
  beforeEach(() => {
    // 모든 테스트는 'system' (auto) 으로 시작.
    useTheme.setState({ preference: 'system', resolved: 'light' });
  });

  afterEach(() => {
    useTheme.setState({ preference: 'system', resolved: 'light' });
  });

  it('radiogroup 과 3 radio 옵션 (Light/Auto/Dark) 을 렌더한다', () => {
    render(<ThemeSegmented />);
    const group = screen.getByRole('radiogroup', { name: '테마 모드' });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveTextContent('Light');
    expect(radios[1]).toHaveTextContent('Auto');
    expect(radios[2]).toHaveTextContent('Dark');
    // 초기 preference='system' → Auto 가 checked.
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[2]).toHaveAttribute('aria-checked', 'false');
  });

  it('Dark 클릭 시 store.preference 가 "dark" 로 바뀐다', async () => {
    const user = userEvent.setup();
    render(<ThemeSegmented />);
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(useTheme.getState().preference).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  });

  it('Auto 클릭 시 store.preference 가 "system" 으로 바뀐다 (UI auto ⇄ store system 매핑)', async () => {
    const user = userEvent.setup();
    // 먼저 light 로 만들어두고
    useTheme.setState({ preference: 'light', resolved: 'light' });
    render(<ThemeSegmented />);
    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(useTheme.getState().preference).toBe('system');
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
  });

  it('ArrowRight 키로 다음 옵션에 focus 가 이동한다', async () => {
    const user = userEvent.setup();
    render(<ThemeSegmented />);
    const auto = screen.getByRole('radio', { name: 'Auto' });
    auto.focus();
    expect(auto).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    // wrap-around
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveFocus();
  });

  it('ArrowLeft 키로 이전 옵션에 focus 가 이동한다', async () => {
    const user = userEvent.setup();
    render(<ThemeSegmented />);
    const auto = screen.getByRole('radio', { name: 'Auto' });
    auto.focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveFocus();
  });

  it('선택되지 않은 옵션은 tabIndex=-1, 선택된 옵션은 tabIndex=0 (roving)', () => {
    useTheme.setState({ preference: 'dark', resolved: 'dark' });
    render(<ThemeSegmented />);
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('tabindex', '0');
  });

  it('motion-reduce:transition-none 클래스로 prefers-reduced-motion 대응', () => {
    render(<ThemeSegmented />);
    const group = screen.getByRole('radiogroup', { name: '테마 모드' });
    // indicator span: aria-hidden=true 인 첫 자식.
    const indicator = group.querySelector('[aria-hidden="true"]');
    expect(indicator).not.toBeNull();
    expect(indicator?.className).toContain('motion-reduce:transition-none');
  });
});
