import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BookCard } from './BookCard.jsx';

const sample = {
  id: 'shelf-1',
  bookId: 'book-1',
  status: 'READ',
  rating: 4,
  review: '한 권을 끝낼 때마다 작게 어른이 되어가는 기분.',
  addedAt: '2026-04-10T00:00:00.000Z',
  completedAt: '2026-04-12T00:00:00.000Z',
  book: {
    id: 'book-1',
    isbn: '9788932917245',
    title: '읽기의 계절',
    author: '김연수',
    coverUrl: null,
  },
};

describe('BookCard', () => {
  it('제목, 저자, status 메타, 감상평을 렌더한다', () => {
    render(<BookCard shelf={sample} onEdit={() => {}} />);
    expect(screen.getByRole('heading', { name: '읽기의 계절' })).toBeInTheDocument();
    expect(screen.getByText('김연수')).toBeInTheDocument();
    expect(screen.getByText(/2026\.04/)).toBeInTheDocument();
    expect(screen.getByText(/한 권을 끝낼 때마다/)).toBeInTheDocument();
  });

  it('READING 일 땐 날짜 없이 "읽는 중"만 표시', () => {
    render(<BookCard shelf={{ ...sample, status: 'READING' }} onEdit={() => {}} />);
    expect(screen.getByText('읽는 중')).toBeInTheDocument();
  });

  it('클릭 시 onEdit(shelf) 호출', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<BookCard shelf={sample} onEdit={onEdit} />);
    await user.click(screen.getByRole('button', { name: /읽기의 계절 편집/ }));
    expect(onEdit).toHaveBeenCalledWith(sample);
  });

  it('rating 4 → 별점 4점 aria-label', () => {
    render(<BookCard shelf={sample} onEdit={() => {}} />);
    expect(screen.getByRole('img', { name: /별점 4점/ })).toBeInTheDocument();
  });
});
