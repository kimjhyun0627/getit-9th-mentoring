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

  it('FULL 상태면 정원 마감 배지 + 숫자 pill (마감 카피 X) + 신청 링크 숨김 + aria-disabled', () => {
    renderCard({ ...POST, status: 'FULL', currentCapacity: 4 });
    // pill 은 숫자만 (#148 — "· 마감" 제거, redundant)
    expect(screen.getByText('4/4')).toBeInTheDocument();
    expect(screen.queryByText('4/4 · 마감')).not.toBeInTheDocument();
    // 하단 배지가 상태 카피를 담당
    expect(screen.getByText('정원 마감')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /신청/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('meetup-card-p-mara')).toHaveAttribute('aria-disabled', 'true');
  });

  it('FULL 상태면 우상단 🎉 amber 리본이 노출된다 (#309 — 잔치 톤)', () => {
    renderCard({ ...POST, status: 'FULL', currentCapacity: 4 });
    const ribbon = screen.getByTestId('meetup-ribbon-p-mara');
    expect(ribbon).toBeInTheDocument();
    expect(ribbon).toHaveTextContent(/🎉 마감/);
    // amber 배경 + 짙은 슬레이트 글자 = WCAG AA 통과 (#311 contrast)
    expect(ribbon.className).toMatch(/bg-amber-300/);
    expect(ribbon.className).toMatch(/text-slate-900/);
    // FULL 은 tone-closed 가 아니어야 함 (컬러 유지)
    const card = screen.getByTestId('meetup-card-p-mara');
    expect(card.className).not.toMatch(/tone-closed/);
    expect(card.className).toMatch(/tone-full/);
  });

  it('CLOSED 상태면 하단 배지가 "모집 종료" 로 차별화된다 (#148 + #309)', () => {
    renderCard({ ...POST, status: 'CLOSED', currentCapacity: 3 });
    expect(screen.getByText('모집 종료')).toBeInTheDocument();
    expect(screen.queryByText('정원 마감')).not.toBeInTheDocument();
    expect(screen.getByText('3/4')).toBeInTheDocument();
    // CLOSED 는 amber 리본 없음 (잔치 X)
    expect(screen.queryByTestId('meetup-ribbon-p-mara')).not.toBeInTheDocument();
    // tone-closed 적용 → grayscale + opacity-60
    const card = screen.getByTestId('meetup-card-p-mara');
    expect(card.className).toMatch(/tone-closed/);
  });

  it('노쇼 카운트가 있으면 경고 배지를 표시한다', () => {
    renderCard({ ...POST, owner: { nickname: '유진', label: '23학번', noShowCount: 1 } });
    expect(screen.getByText(/노쇼 1회/)).toBeInTheDocument();
  });
});
