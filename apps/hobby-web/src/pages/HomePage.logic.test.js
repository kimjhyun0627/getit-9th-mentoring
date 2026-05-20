import { describe, expect, it } from 'vitest';

import { filterPosts } from './HomePage.logic.js';

// NOW 는 로컬 자정 기준이므로 timezone offset 영향 안 받게 로컬 Date 생성자 사용.
const NOW = new Date(2026, 4, 19, 10, 0, 0); // 2026-05-19 10:00 local

const make = (over = {}) => ({
  id: over.id ?? 'p1',
  title: over.title ?? '북문 마라탕',
  location: over.location ?? '북문 라화방',
  tags: over.tags ?? [
    { id: 't1', name: '마라탕' },
    { id: 't2', name: '맛집' },
  ],
  meetAt: over.meetAt ?? new Date(2026, 4, 19, 18, 0, 0).toISOString(),
  status: over.status ?? 'RECRUITING',
  capacity: 4,
  currentCapacity: 2,
});

describe('filterPosts — 검색 + 시간', () => {
  it('빈 검색어는 전체 통과시킨다', () => {
    const posts = [make({ id: '1' }), make({ id: '2', title: '풋살' })];
    expect(filterPosts(posts, { search: '', timeKey: 'all', now: NOW })).toHaveLength(2);
  });

  it('제목 부분 일치로 검색된다', () => {
    const posts = [
      make({ id: '1', title: '북문 마라탕', tags: [] }),
      make({ id: '2', title: '풋살 한판', tags: [] }),
    ];
    const out = filterPosts(posts, { search: '마라', timeKey: 'all', now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('1');
  });

  it('태그 이름으로도 검색된다 (case-insensitive)', () => {
    const posts = [
      make({ id: '1', title: 'foo', tags: [{ id: 't', name: '카페' }] }),
      make({ id: '2', title: 'bar', tags: [{ id: 't', name: '스터디' }] }),
    ];
    const out = filterPosts(posts, { search: '카페', timeKey: 'all', now: NOW });
    expect(out.map((p) => p.id)).toEqual(['1']);
  });

  it('timeKey=today 는 오늘 모임만 통과시킨다', () => {
    const posts = [
      make({ id: 'today', meetAt: new Date(2026, 4, 19, 22, 0, 0).toISOString() }),
      make({ id: 'tomorrow', meetAt: new Date(2026, 4, 20, 10, 0, 0).toISOString() }),
      make({ id: 'next-week', meetAt: new Date(2026, 4, 28, 10, 0, 0).toISOString() }),
    ];
    const out = filterPosts(posts, { search: '', timeKey: 'today', now: NOW });
    expect(out.map((p) => p.id)).toEqual(['today']);
  });

  it('timeKey=week 는 오늘부터 7일 이내 모임만 통과시킨다', () => {
    const posts = [
      make({ id: 'today', meetAt: new Date(2026, 4, 19, 22, 0, 0).toISOString() }),
      make({ id: 'in6', meetAt: new Date(2026, 4, 25, 10, 0, 0).toISOString() }),
      make({ id: 'in8', meetAt: new Date(2026, 4, 27, 10, 0, 0).toISOString() }),
    ];
    const out = filterPosts(posts, { search: '', timeKey: 'week', now: NOW });
    expect(out.map((p) => p.id).sort()).toEqual(['in6', 'today']);
  });

  it('잘못된 meetAt 은 시간 필터에서 제외된다', () => {
    const posts = [make({ id: 'bad', meetAt: 'not-a-date' })];
    expect(filterPosts(posts, { search: '', timeKey: 'today', now: NOW })).toHaveLength(0);
  });
});
