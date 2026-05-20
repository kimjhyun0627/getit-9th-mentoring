import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilterTabs } from './FilterTabs.jsx';

const counts = { ALL: 8, READ: 4, READING: 1, WANT: 3 };

describe('FilterTabs', () => {
  it('4개 탭과 카운트를 렌더한다', () => {
    render(<FilterTabs active="ALL" onChange={() => {}} counts={counts} />);
    expect(screen.getByRole('tab', { name: /^All/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Read\b/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Reading/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Wishlist/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^All/ })).toHaveTextContent('8');
  });

  it('active 탭은 aria-selected=true', () => {
    render(<FilterTabs active="READ" onChange={() => {}} counts={counts} />);
    const readTab = screen.getByRole('tab', { name: /^Read\b/ });
    expect(readTab).toHaveAttribute('aria-selected', 'true');
  });

  it('클릭 시 onChange 호출', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterTabs active="ALL" onChange={onChange} counts={counts} />);
    await user.click(screen.getByRole('tab', { name: /^Wishlist/ }));
    expect(onChange).toHaveBeenCalledWith('WANT');
  });
});
