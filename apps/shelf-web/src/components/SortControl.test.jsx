import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SortControl } from './SortControl.jsx';

describe('SortControl', () => {
  it('현재 정렬 키를 표시한다', () => {
    render(<SortControl value="rating-desc" onChange={() => {}} />);
    const select = screen.getByRole('combobox', { name: /정렬/ });
    expect(select).toHaveValue('rating-desc');
  });

  it('5개 정렬 옵션이 노출된다', () => {
    render(<SortControl value="addedAt-desc" onChange={() => {}} />);
    const select = screen.getByRole('combobox', { name: /정렬/ });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /최근 추가/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /오래된 순/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /최근 완독/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /별점 높은/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /제목/ })).toBeInTheDocument();
  });

  it('값 변경 시 onChange 가 새 sort 키로 호출된다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SortControl value="addedAt-desc" onChange={onChange} />);
    await user.selectOptions(screen.getByRole('combobox', { name: /정렬/ }), 'rating-desc');
    expect(onChange).toHaveBeenCalledWith('rating-desc');
  });
});
