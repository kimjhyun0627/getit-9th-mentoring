import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RatingFilter } from './RatingFilter.jsx';

describe('RatingFilter (#199)', () => {
  it('0~5 옵션 6개를 렌더한다 (전체 + 1~5점)', () => {
    render(<RatingFilter value={0} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /별점 필터 전체/ })).toBeInTheDocument();
    for (const n of [1, 2, 3, 4, 5]) {
      expect(
        screen.getByRole('button', { name: new RegExp(`별점 필터 ${n}점 이상`) }),
      ).toBeInTheDocument();
    }
  });

  it('value=3 인 옵션은 aria-pressed=true', () => {
    render(<RatingFilter value={3} onChange={() => {}} />);
    const active = screen.getByRole('button', { name: /별점 필터 3점 이상/ });
    expect(active).toHaveAttribute('aria-pressed', 'true');
  });

  it('옵션 클릭 → onChange(n) 호출', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RatingFilter value={0} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /별점 필터 4점 이상/ }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
