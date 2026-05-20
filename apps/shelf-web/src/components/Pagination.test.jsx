import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './Pagination.jsx';

describe('Pagination (#269)', () => {
  it('totalPages <= 1 이면 렌더하지 않는다', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('현재 페이지 버튼은 aria-current=page', () => {
    render(<Pagination page={3} totalPages={5} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '3', current: 'page' })).toBeInTheDocument();
  });

  it('이전 버튼은 page=1 일 때 disabled', () => {
    render(<Pagination page={1} totalPages={5} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled();
  });

  it('다음 버튼은 page=totalPages 일 때 disabled', () => {
    render(<Pagination page={5} totalPages={5} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled();
  });

  it('총 12 페이지 + 현재 6 → 1 … 5 6 7 … 12 슬롯 노출', () => {
    render(<Pagination page={6} totalPages={12} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6', current: 'page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '12' })).toBeInTheDocument();
    // 갭 노출 (… 2개)
    expect(screen.getAllByText('…')).toHaveLength(2);
  });

  it('페이지 버튼 클릭 → onChange(번호)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination page={1} totalPages={5} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '3' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('현재 페이지를 다시 클릭하면 onChange 호출 안 됨', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '3', current: 'page' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
