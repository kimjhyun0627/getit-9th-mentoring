import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilterChips } from './FilterChips.jsx';

const setup = (over = {}) => {
  const onTimeChange = vi.fn();
  const onTagChange = vi.fn();
  render(
    <FilterChips
      timeKey={over.timeKey ?? 'all'}
      onTimeChange={onTimeChange}
      tagKey={over.tagKey ?? null}
      onTagChange={onTagChange}
    />,
  );
  return { onTimeChange, onTagChange };
};

describe('FilterChips', () => {
  it('시간 칩 (전체/오늘/이번주) 3개를 렌더한다', () => {
    setup();
    expect(screen.getByRole('tab', { name: /전체/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /오늘/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /이번주/ })).toBeInTheDocument();
  });

  it('활성 시간 칩에 aria-selected=true 가 걸린다', () => {
    setup({ timeKey: 'today' });
    expect(screen.getByRole('tab', { name: /오늘/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /전체/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('태그 칩 클릭 시 onTagChange 가 호출된다', async () => {
    const user = userEvent.setup();
    const { onTagChange } = setup();
    await user.click(screen.getByRole('button', { name: '#맛집' }));
    expect(onTagChange).toHaveBeenCalledWith('맛집');
  });

  it('이미 선택된 태그를 다시 누르면 null 로 토글된다', async () => {
    const user = userEvent.setup();
    const { onTagChange } = setup({ tagKey: '맛집' });
    await user.click(screen.getByRole('button', { name: '#맛집' }));
    expect(onTagChange).toHaveBeenCalledWith(null);
  });
});
