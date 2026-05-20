import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { MeetupCard } from './MeetupCard.jsx';

const renderCard = (post) =>
  render(
    <MemoryRouter>
      <MeetupCard post={post} />
    </MemoryRouter>,
  );

const POST = {
  id: 'p-mara',
  title: '북문 마라탕 같이 갈 사람!',
  meetAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
  capacity: 4,
  currentCapacity: 2,
  status: 'RECRUITING',
  tags: [
    { id: 't1', name: '마라탕' },
    { id: 't2', name: '북문' },
    { id: 't3', name: '맛집' },
  ],
  owner: { nickname: '진현', label: '멘토' },
  location: '북문 라화방',
};

describe('MeetupCard', () => {
  it('제목과 인원 (2/4) 을 렌더한다', () => {
    renderCard(POST);
    expect(screen.getByText('북문 마라탕 같이 갈 사람!')).toBeInTheDocument();
    expect(screen.getByText('2/4')).toBeInTheDocument();
  });

  it('태그 목록을 #태그 형식으로 렌더한다', () => {
    renderCard(POST);
    expect(screen.getByText('#마라탕')).toBeInTheDocument();
    expect(screen.getByText('#북문')).toBeInTheDocument();
    expect(screen.getByText('#맛집')).toBeInTheDocument();
  });

  it('RECRUITING 상태면 신청 링크가 보인다', () => {
    renderCard(POST);
    const link = screen.getByRole('link', { name: /신청/ });
    expect(link).toHaveAttribute('href', '/posts/p-mara');
  });

  it('FULL 상태면 정원 마감 표시 + 신청 링크 숨김 + aria-disabled', () => {
    renderCard({ ...POST, status: 'FULL', currentCapacity: 4 });
    expect(screen.getByText('4/4 · 마감')).toBeInTheDocument();
    expect(screen.getByText('정원 마감')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /신청/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('meetup-card-p-mara')).toHaveAttribute('aria-disabled', 'true');
  });

  it('노쇼 카운트가 있으면 경고 배지를 표시한다', () => {
    renderCard({ ...POST, owner: { nickname: '유진', label: '23학번', noShowCount: 1 } });
    expect(screen.getByText(/노쇼 1회/)).toBeInTheDocument();
  });
});
