import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BookCard, BookCardSkeleton } from './BookCard.jsx';

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
    await user.click(screen.getByRole('button', { name: /읽기의 계절 자세히 보기/ }));
    expect(onEdit).toHaveBeenCalledWith(sample);
  });

  it('rating 4 → 별점 4점 aria-label', () => {
    render(<BookCard shelf={sample} onEdit={() => {}} />);
    expect(screen.getByRole('img', { name: /별점 4점/ })).toBeInTheDocument();
  });

  it('focus-visible 링 클래스가 적용되어 있다 (#248 키보드 가시성)', () => {
    render(<BookCard shelf={sample} onEdit={() => {}} />);
    const btn = screen.getByRole('button', { name: /읽기의 계절 자세히 보기/ });
    expect(btn.className).toMatch(/focus-visible:ring-2/);
  });

  it('표지 없을 때 mix-blend-difference 대신 잉크 스크림 + 흰 글자 (#243)', () => {
    const { container } = render(<BookCard shelf={sample} onEdit={() => {}} />);
    // 회귀 가드: mix-blend-difference 클래스가 더 이상 본문에 붙지 않는다
    expect(container.querySelector('.mix-blend-difference')).toBeNull();
    // 잉크 스크림 (검은색 그라데이션) 이 존재
    const scrim = container.querySelector('[aria-hidden="true"].bg-gradient-to-t');
    expect(scrim).not.toBeNull();
  });
});

describe('BookCardSkeleton (#301 로딩 스켈레톤)', () => {
  it('aria-hidden=true — SR announce 는 부모 컨테이너가 담당 (CR #353)', () => {
    const { container } = render(<BookCardSkeleton />);
    const sk = container.firstChild;
    expect(sk).toHaveAttribute('aria-hidden', 'true');
  });

  it('shimmer 자식이 존재 (book-skeleton-shimmer 클래스)', () => {
    const { container } = render(<BookCardSkeleton />);
    expect(container.querySelectorAll('.book-skeleton-shimmer').length).toBeGreaterThan(0);
  });
});
