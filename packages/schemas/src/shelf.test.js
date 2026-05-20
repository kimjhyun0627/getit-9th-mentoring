import { describe, it, expect } from 'vitest';

import {
  SHELF_SORT_DEFAULT,
  ShelfAddInput,
  ShelfSortKey,
  ShelfStatus,
  ShelfUpdateInput,
} from './shelf.js';

describe('ShelfStatus', () => {
  it.each(['WANT', 'READING', 'READ'])('"%s" 통과', (s) => {
    expect(ShelfStatus.safeParse(s).success).toBe(true);
  });

  it('알 수 없는 값 거부', () => {
    expect(ShelfStatus.safeParse('UNKNOWN').success).toBe(false);
  });
});

describe('ShelfAddInput', () => {
  it('bookId 단독 통과 (status 기본값 WANT)', () => {
    const r = ShelfAddInput.safeParse({ bookId: 'b_1' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe('WANT');
  });

  it('isbn 단독 통과', () => {
    const r = ShelfAddInput.safeParse({ isbn: '9788932917245' });
    expect(r.success).toBe(true);
  });

  it('잘못된 isbn 거부', () => {
    const r = ShelfAddInput.safeParse({ isbn: 'not-isbn' });
    expect(r.success).toBe(false);
  });

  it('하이픈 포함 isbn 정규화 후 통과', () => {
    const r = ShelfAddInput.safeParse({ isbn: '978-89-329-1724-5' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isbn).toBe('9788932917245');
  });

  it('공백 포함 isbn 정규화 후 통과', () => {
    const r = ShelfAddInput.safeParse({ isbn: '9788932917245 ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isbn).toBe('9788932917245');
  });

  it('isbn/bookId 모두 누락 거부', () => {
    const r = ShelfAddInput.safeParse({ status: 'WANT' });
    expect(r.success).toBe(false);
  });

  it.each([
    [-1, false],
    [0, true],
    [3, true],
    [5, true],
    [6, false],
    [3.5, false],
  ])('rating=%s → success=%s', (rating, success) => {
    const r = ShelfAddInput.safeParse({ bookId: 'b_1', rating });
    expect(r.success).toBe(success);
  });
});

describe('ShelfUpdateInput', () => {
  it('status 만 → 통과', () => {
    expect(ShelfUpdateInput.safeParse({ status: 'READ' }).success).toBe(true);
  });

  it('rating 만 → 통과', () => {
    expect(ShelfUpdateInput.safeParse({ rating: 4 }).success).toBe(true);
  });

  it('rating: null → 통과 (별점 제거)', () => {
    expect(ShelfUpdateInput.safeParse({ rating: null }).success).toBe(true);
  });

  it('빈 객체 거부 (최소 1개 필드)', () => {
    expect(ShelfUpdateInput.safeParse({}).success).toBe(false);
  });

  it('rating 6 → 거부', () => {
    expect(ShelfUpdateInput.safeParse({ rating: 6 }).success).toBe(false);
  });
});

describe('ShelfSortKey', () => {
  it.each(['addedAt-desc', 'addedAt-asc', 'completedAt-desc', 'rating-desc', 'title-asc'])(
    '"%s" 통과',
    (k) => {
      expect(ShelfSortKey.safeParse(k).success).toBe(true);
    },
  );

  it('알 수 없는 키 거부', () => {
    expect(ShelfSortKey.safeParse('bogus').success).toBe(false);
  });

  it('기본 정렬 키는 addedAt-desc', () => {
    expect(SHELF_SORT_DEFAULT).toBe('addedAt-desc');
    expect(ShelfSortKey.safeParse(SHELF_SORT_DEFAULT).success).toBe(true);
  });
});
