import { ThemeProvider } from '@getit/theme';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PlayfulThemeToggle } from './PlayfulThemeToggle.jsx';

const renderToggle = () =>
  render(
    <ThemeProvider>
      <PlayfulThemeToggle />
    </ThemeProvider>,
  );

describe('PlayfulThemeToggle', () => {
  it('role=switch + aria-checked + aria-label 가 일관된다', () => {
    renderToggle();
    const btn = screen.getByRole('switch');
    expect(btn).toHaveAttribute('aria-checked', 'false');
    expect(btn).toHaveAttribute('aria-label', '다크모드로 전환');
  });

  it('클릭하면 aria-checked / aria-label / <html>.dark 가 토글된다', async () => {
    const user = userEvent.setup();
    renderToggle();
    const btn = screen.getByRole('switch');

    await user.click(btn);
    expect(btn).toHaveAttribute('aria-checked', 'true');
    expect(btn).toHaveAttribute('aria-label', '라이트모드로 전환');
    expect(document.documentElement).toHaveClass('dark');

    await user.click(btn);
    expect(btn).toHaveAttribute('aria-checked', 'false');
    expect(btn).toHaveAttribute('aria-label', '다크모드로 전환');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('키보드 Space/Enter 로도 토글된다', async () => {
    const user = userEvent.setup();
    renderToggle();
    const btn = screen.getByRole('switch');
    btn.focus();

    await user.keyboard(' ');
    expect(btn).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{Enter}');
    expect(btn).toHaveAttribute('aria-checked', 'false');
  });
});
