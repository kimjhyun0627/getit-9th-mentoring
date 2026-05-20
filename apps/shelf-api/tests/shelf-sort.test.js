/**
 * compareBy unit 테스트 — supertest/JWT 의존 없이 정렬 로직만.
 *
 * Issue #196 가드.
 */
import { describe, expect, it } from 'vitest';

import { compareBy } from '../src/lib/shelf-sort.js';

const makeRow = (overrides) => ({
  id: 'r',
  rating: null,
  completedAt: null,
  addedAt: new Date('2026-05-01'),
  book: { title: '책' },
  ...overrides,
});

describe('compareBy', () => {
  it('addedAt-desc (기본): 신규 → 오래된', () => {
    const rows = [
      makeRow({ id: 'a', addedAt: new Date('2026-04-01') }),
      makeRow({ id: 'b', addedAt: new Date('2026-05-10') }),
      makeRow({ id: 'c', addedAt: new Date('2026-05-01') }),
    ];
    const sorted = [...rows].sort(compareBy('addedAt-desc')).map((r) => r.id);
    expect(sorted).toEqual(['b', 'c', 'a']);
  });

  it('addedAt-asc: 오래된 → 신규', () => {
    const rows = [
      makeRow({ id: 'a', addedAt: new Date('2026-05-10') }),
      makeRow({ id: 'b', addedAt: new Date('2026-04-01') }),
    ];
    const sorted = [...rows].sort(compareBy('addedAt-asc')).map((r) => r.id);
    expect(sorted).toEqual(['b', 'a']);
  });

  it('completedAt-desc: 최근 완독, null 은 뒤', () => {
    const rows = [
      makeRow({ id: 'null1' }),
      makeRow({ id: 'recent', completedAt: new Date('2026-05-15') }),
      makeRow({ id: 'old', completedAt: new Date('2026-04-01') }),
      makeRow({ id: 'null2' }),
    ];
    const sorted = [...rows].sort(compareBy('completedAt-desc')).map((r) => r.id);
    expect(sorted.slice(0, 2)).toEqual(['recent', 'old']);
    expect(new Set(sorted.slice(2))).toEqual(new Set(['null1', 'null2']));
  });

  it('rating-desc: 별점 높은 순, null/0 처리 (null 은 뒤, 0 은 0)', () => {
    const rows = [
      makeRow({ id: 'r0', rating: 0 }),
      makeRow({ id: 'r5', rating: 5 }),
      makeRow({ id: 'rn', rating: null }),
      makeRow({ id: 'r3', rating: 3 }),
    ];
    const sorted = [...rows].sort(compareBy('rating-desc')).map((r) => r.id);
    expect(sorted).toEqual(['r5', 'r3', 'r0', 'rn']);
  });

  it('rating-desc: 동점일 때 addedAt desc 로 tie-break', () => {
    const rows = [
      makeRow({ id: 'older', rating: 5, addedAt: new Date('2026-04-01') }),
      makeRow({ id: 'newer', rating: 5, addedAt: new Date('2026-05-01') }),
    ];
    const sorted = [...rows].sort(compareBy('rating-desc')).map((r) => r.id);
    expect(sorted).toEqual(['newer', 'older']);
  });

  it('title-asc: 가나다 순', () => {
    const rows = [
      makeRow({ id: 'a', book: { title: '나' } }),
      makeRow({ id: 'b', book: { title: '가' } }),
      makeRow({ id: 'c', book: { title: '다' } }),
    ];
    const sorted = [...rows].sort(compareBy('title-asc')).map((r) => r.id);
    expect(sorted).toEqual(['b', 'a', 'c']);
  });

  it('알 수 없는 키 → addedAt-desc 로 폴백', () => {
    const rows = [
      makeRow({ id: 'a', addedAt: new Date('2026-04-01') }),
      makeRow({ id: 'b', addedAt: new Date('2026-05-10') }),
    ];
    const sorted = [...rows].sort(compareBy('bogus')).map((r) => r.id);
    expect(sorted).toEqual(['b', 'a']);
  });
});
