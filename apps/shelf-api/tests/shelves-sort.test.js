/**
 * /api/shelves/me?sort=<key> 정렬 통합 테스트 (Issue #196).
 *
 * 정렬 옵션:
 *   addedAt-desc (default) / addedAt-asc / completedAt-desc / rating-desc / title-asc
 *
 * 추가로 응답에 `i_added` (search → shelf 추가 후 새로고침 시 표시 유지) 가 GET 응답에서는
 * 항상 true 임을 가드 (#217).
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { createApp } from '../src/app.js';

import { authHeader, seedBook } from './helpers.js';
import { memDb } from './setup.js';

const ALICE = 'alice';

/** @type {import('express').Express} */
let app;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
  app = createApp({ rateLimitMax: 1000 });
});

/**
 * Alice 서가 4권 시드 — 정렬 키마다 순서가 달라지도록 의도적 배치.
 *
 *   book   | title | rating | addedAt    | completedAt
 *   -------+-------+--------+------------+-----------
 *   B-old  | 가    | 5      | 2026-04-01 | 2026-05-15
 *   B-mid  | 라    | null   | 2026-04-15 | null
 *   B-new  | 나    | 3      | 2026-05-01 | 2026-05-05
 *   B-late | 다    | 5      | 2026-05-10 | null
 */
const seedFour = async () => {
  const fixtures = [
    {
      id: 'b_old',
      isbn: '9788900000001',
      title: '가',
      rating: 5,
      addedAt: new Date('2026-04-01'),
      completedAt: new Date('2026-05-15'),
      status: 'READ',
    },
    {
      id: 'b_mid',
      isbn: '9788900000002',
      title: '라',
      rating: null,
      addedAt: new Date('2026-04-15'),
      completedAt: null,
      status: 'WANT',
    },
    {
      id: 'b_new',
      isbn: '9788900000003',
      title: '나',
      rating: 3,
      addedAt: new Date('2026-05-01'),
      completedAt: new Date('2026-05-05'),
      status: 'READ',
    },
    {
      id: 'b_late',
      isbn: '9788900000004',
      title: '다',
      rating: 5,
      addedAt: new Date('2026-05-10'),
      completedAt: null,
      status: 'READING',
    },
  ];
  for (const f of fixtures) {
    await seedBook({ isbn: f.isbn, title: f.title });
    const book = [...memDb.books.values()].find((b) => b.isbn === f.isbn);
    memDb.bookShelves.set(`bs_${f.id}`, {
      id: `bs_${f.id}`,
      userId: ALICE,
      bookId: book.id,
      status: f.status,
      rating: f.rating,
      review: null,
      addedAt: f.addedAt,
      completedAt: f.completedAt,
    });
  }
};

const titlesFromRes = (res) => res.body.shelves.map((s) => s.book.title);

describe('GET /api/shelves/me?sort=<key>', () => {
  beforeEach(async () => {
    await seedFour();
  });

  it('기본값 addedAt-desc — 신규 → 오래된', async () => {
    const res = await request(app).get('/api/shelves/me').set(authHeader(ALICE));
    expect(res.status).toBe(200);
    expect(titlesFromRes(res)).toEqual(['다', '나', '라', '가']);
  });

  it('sort=addedAt-asc — 오래된 → 신규', async () => {
    const res = await request(app).get('/api/shelves/me?sort=addedAt-asc').set(authHeader(ALICE));
    expect(res.status).toBe(200);
    expect(titlesFromRes(res)).toEqual(['가', '라', '나', '다']);
  });

  it('sort=completedAt-desc — 최근 완독 순, null 은 addedAt desc tie-break', async () => {
    const res = await request(app)
      .get('/api/shelves/me?sort=completedAt-desc')
      .set(authHeader(ALICE));
    expect(res.status).toBe(200);
    // '가' 완독 2026-05-15, '나' 완독 2026-05-05 — null 인 '다'(addedAt 5-10), '라'(addedAt 4-15)
    expect(titlesFromRes(res)).toEqual(['가', '나', '다', '라']);
  });

  it('sort=rating-desc — 별점 높은 순, 동점은 addedAt desc tie-break, null 은 뒤', async () => {
    const res = await request(app).get('/api/shelves/me?sort=rating-desc').set(authHeader(ALICE));
    expect(res.status).toBe(200);
    // 별점 5: '다'(addedAt 5-10) > '가'(addedAt 4-1) — 3: '나' — null: '라'
    expect(titlesFromRes(res)).toEqual(['다', '가', '나', '라']);
  });

  it('pagination + sort=rating-desc — 전역 정렬 후 페이지 자르기 (page=2)', async () => {
    const res = await request(app)
      .get('/api/shelves/me?sort=rating-desc&page=2&pageSize=2')
      .set(authHeader(ALICE));
    expect(res.status).toBe(200);
    // 전역 정렬: 다, 가, 나, 라 → 2 페이지 (size=2) = 나, 라
    expect(titlesFromRes(res)).toEqual(['나', '라']);
    expect(res.body.pagination).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 4,
      sort: 'rating-desc',
    });
  });

  it('sort=<array> (?sort=a&sort=b) → 400', async () => {
    const res = await request(app)
      .get('/api/shelves/me?sort=addedAt-desc&sort=rating-desc')
      .set(authHeader(ALICE));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('sort=title-asc — 가나다 순', async () => {
    const res = await request(app).get('/api/shelves/me?sort=title-asc').set(authHeader(ALICE));
    expect(res.status).toBe(200);
    expect(titlesFromRes(res)).toEqual(['가', '나', '다', '라']);
  });

  it('알 수 없는 sort → 400', async () => {
    const res = await request(app).get('/api/shelves/me?sort=bogus-key').set(authHeader(ALICE));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('GET /me 응답에 i_added=true 가 포함된다 (#217 search 페이지가 cross-reference)', async () => {
    const res = await request(app).get('/api/shelves/me').set(authHeader(ALICE));
    expect(res.status).toBe(200);
    for (const shelf of res.body.shelves) {
      expect(shelf.i_added).toBe(true);
    }
  });
});
