import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StarRating } from './StarRating.jsx';

describe('StarRating', () => {
  it('readonly 일 때 별점 라벨을 표시한다', () => {
    render(<StarRating value={4} readonly />);
    expect(screen.getByRole('img', { name: /별점 4점/ })).toBeInTheDocument();
  });

  it('value=0 readonly 면 별점 없음을 알린다', () => {
    render(<StarRating value={0} readonly />);
    expect(screen.getByRole('img', { name: /별점 없음/ })).toBeInTheDocument();
  });

  it('interactive 모드에서 별 클릭 시 onChange 호출', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StarRating value={2} onChange={onChange} />);
    const star4 = screen.getByRole('radio', { name: '별점 4점' });
    await user.click(star4);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('value>0 일 때 지우기 버튼 → onChange(0)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StarRating value={3} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '별점 지우기' }));
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
