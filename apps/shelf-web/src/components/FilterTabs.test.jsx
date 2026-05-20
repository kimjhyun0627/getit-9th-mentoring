import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilterTabs } from './FilterTabs.jsx';

const counts = { ALL: 8, READ: 4, READING: 1, WANT: 3 };

describe('FilterTabs', () => {
  it('4개 탭과 카운트를 렌더한다', () => {
    render(<FilterTabs active="ALL" onChange={() => {}} counts={counts} />);
    expect(screen.getByRole('button', { name: /^All/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Read\b/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reading/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Wishlist/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^All/ })).toHaveTextContent('8');
  });

  it('active 탭은 aria-pressed=true', () => {
    render(<FilterTabs active="READ" onChange={() => {}} counts={counts} />);
    const readTab = screen.getByRole('button', { name: /^Read\b/ });
    expect(readTab).toHaveAttribute('aria-pressed', 'true');
  });

  it('클릭 시 onChange 호출', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterTabs active="ALL" onChange={onChange} counts={counts} />);
    await user.click(screen.getByRole('button', { name: /^Wishlist/ }));
    expect(onChange).toHaveBeenCalledWith('WANT');
  });

  it('각 탭의 aria-label 에 한국어 의미가 포함된다 (issue #128)', () => {
    render(<FilterTabs active="ALL" onChange={() => {}} counts={counts} />);
    expect(screen.getByRole('button', { name: /전체 보기/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /읽은 책 보기/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /읽는 중 보기/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /읽고 싶은 책 보기/ })).toBeInTheDocument();
  });
});
