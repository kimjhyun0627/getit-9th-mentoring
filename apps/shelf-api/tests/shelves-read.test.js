/**
 * /api/shelves GET (read) 통합 테스트.
 *
 * - 인증 없음 → 401
 * - 내 서재만 노출 (다른 유저 row 거름)
 * - 빈 서재 → 200 + 빈 배열
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

import { authHeader, seedBook } from './helpers.js';
import { memDb } from './setup.js';

const ALICE = 'alice';
const BOB = 'bob';

describe('GET /api/shelves/me', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
    app = createApp({ rateLimitMax: 1000 });
  });

  it('인증 없음 → 401', async () => {
    const res = await request(app).get('/api/shelves/me');
    expect(res.status).toBe(401);
  });

  it('내 서재만 반환 (다른 유저 row 제외)', async () => {
    const book1 = await seedBook({ isbn: '9788932917245', title: 'A' });
    const book2 = await seedBook({ isbn: '9788937473135', title: 'B' });

    // alice 가 book1 / bob 이 book2 — 직접 memDb 에 주입해 라우터 거치지 않은 격리 시드
    memDb.bookShelves.set('bs_seed_1', {
      id: 'bs_seed_1',
      userId: ALICE,
      bookId: book1.id,
      status: 'WANT',
      rating: null,
      review: null,
      addedAt: new Date('2026-05-01'),
      completedAt: null,
    });
    memDb.bookShelves.set('bs_seed_2', {
      id: 'bs_seed_2',
      userId: BOB,
      bookId: book2.id,
      status: 'READ',
      rating: 5,
      review: null,
      addedAt: new Date('2026-05-02'),
      completedAt: new Date('2026-05-10'),
    });

    const res = await request(app).get('/api/shelves/me').set(authHeader(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.shelves).toHaveLength(1);
    expect(res.body.shelves[0]).toMatchObject({ bookId: book1.id, status: 'WANT' });
    expect(res.body.shelves[0].book).toMatchObject({ title: 'A' });
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20, total: 1 });
  });

  it('빈 서재 → 200 + 빈 배열 + total 0', async () => {
    const res = await request(app).get('/api/shelves/me').set(authHeader(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.shelves).toEqual([]);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20, total: 0 });
  });

  it('pagination — page/pageSize 적용 + total 정확', async () => {
    const books = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        seedBook({ isbn: `97889329172${i}${i}`, title: `T${i}` }),
      ),
    );
    books.forEach((b, i) => {
      memDb.bookShelves.set(`bs_p_${i}`, {
        id: `bs_p_${i}`,
        userId: ALICE,
        bookId: b.id,
        status: 'WANT',
        rating: null,
        review: null,
        addedAt: new Date(`2026-05-${10 + i}`),
        completedAt: null,
      });
    });

    const res = await request(app).get('/api/shelves/me?page=2&pageSize=2').set(authHeader(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.shelves).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 2, pageSize: 2, total: 5 });
  });

  it('pageSize 상한 100 적용', async () => {
    const res = await request(app)
      .get('/api/shelves/me?page=1&pageSize=999')
      .set(authHeader(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(100);
  });
});

describe('GET /api/shelves/u/:userId (#292 공개 서재)', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
    app = createApp({ rateLimitMax: 1000 });
  });

  it('비로그인이어도 200 + 공개 서재', async () => {
    const book = await seedBook({ isbn: '9788932917245', title: 'A' });
    memDb.bookShelves.set('bs_public_1', {
      id: 'bs_public_1',
      userId: ALICE,
      userNickname: '앨리스',
      bookId: book.id,
      status: 'READ',
      rating: 5,
      review: '인생책',
      addedAt: new Date('2026-05-01'),
      completedAt: new Date('2026-05-02'),
    });

    const res = await request(app).get('/api/shelves/u/alice');
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('alice');
    expect(res.body.shelves).toHaveLength(1);
    expect(res.body.shelves[0]).toMatchObject({
      bookId: book.id,
      status: 'READ',
      rating: 5,
      review: '인생책',
    });
    // 공개 응답은 userId/i_added 미노출.
    expect(res.body.shelves[0].userId).toBeUndefined();
    expect(res.body.shelves[0].i_added).toBeUndefined();
  });

  // #565 — UserShelfPage 헤더가 `@cuid` 대신 닉네임 보이려면
  // BE 응답에 nickname 필드 필요. BookShelf.userNickname 스냅샷 (#564) 활용.
  it('nickname 스냅샷 있으면 응답에 nickname 포함', async () => {
    const book = await seedBook({ isbn: '9788932917245', title: 'A' });
    memDb.bookShelves.set('bs_nick_1', {
      id: 'bs_nick_1',
      userId: ALICE,
      userNickname: '앨리스',
      bookId: book.id,
      status: 'READ',
      addedAt: new Date('2026-05-01'),
    });

    const res = await request(app).get('/api/shelves/u/alice');
    expect(res.status).toBe(200);
    expect(res.body.nickname).toBe('앨리스');
  });

  it('가장 최근 row 의 userNickname 가 null 이면 nickname=null', async () => {
    const book = await seedBook({ isbn: '9788932917245', title: 'A' });
    memDb.bookShelves.set('bs_nick_null_1', {
      id: 'bs_nick_null_1',
      userId: ALICE,
      userNickname: null,
      bookId: book.id,
      status: 'READ',
      addedAt: new Date('2026-05-01'),
    });

    const res = await request(app).get('/api/shelves/u/alice');
    expect(res.status).toBe(200);
    expect(res.body.nickname).toBeNull();
  });

  // CR #566 — 공백만 있는 nickname 도 fallback 처리 (snapshot 표준).
  it('가장 최근 row 의 userNickname 가 공백 이면 nickname=null', async () => {
    const book1 = await seedBook({ isbn: '9788932917245', title: 'A' });
    const book2 = await seedBook({ isbn: '9788937473135', title: 'B' });
    memDb.bookShelves.set('bs_nick_blank_1', {
      id: 'bs_nick_blank_1',
      userId: ALICE,
      userNickname: '앨리스',
      bookId: book1.id,
      status: 'READ',
      addedAt: new Date('2026-05-01'),
    });
    memDb.bookShelves.set('bs_nick_blank_2', {
      id: 'bs_nick_blank_2',
      userId: ALICE,
      userNickname: '   ', // 공백
      bookId: book2.id,
      status: 'READ',
      addedAt: new Date('2026-05-10'), // 더 최근
    });

    const res = await request(app).get('/api/shelves/u/alice');
    expect(res.status).toBe(200);
    // 최신 스냅샷이 공백 → 과거 비공백 닉네임으로 fallback 안 함.
    expect(res.body.nickname).toBeNull();
  });

  // CR #566 — 최신 row 가 항상 진실. 과거 닉으로 stale fallback 금지.
  it('최신 row userNickname=null 이면 과거 non-null nickname 으로 fallback 안 함', async () => {
    const book1 = await seedBook({ isbn: '9788932917245', title: 'A' });
    const book2 = await seedBook({ isbn: '9788937473135', title: 'B' });
    memDb.bookShelves.set('bs_stale_1', {
      id: 'bs_stale_1',
      userId: ALICE,
      userNickname: '옛닉',
      bookId: book1.id,
      status: 'READ',
      addedAt: new Date('2026-05-01'),
    });
    memDb.bookShelves.set('bs_stale_2', {
      id: 'bs_stale_2',
      userId: ALICE,
      userNickname: null,
      bookId: book2.id,
      status: 'READ',
      addedAt: new Date('2026-05-10'), // 더 최근
    });

    const res = await request(app).get('/api/shelves/u/alice');
    expect(res.status).toBe(200);
    expect(res.body.nickname).toBeNull();
  });

  it('빈 서재 → nickname=null', async () => {
    const res = await request(app).get('/api/shelves/u/ghost');
    expect(res.status).toBe(200);
    expect(res.body.shelves).toEqual([]);
    expect(res.body.nickname).toBeNull();
  });

  it('다른 유저 서재 row 는 노출 X', async () => {
    const book = await seedBook({ isbn: '9788932917245', title: 'A' });
    memDb.bookShelves.set('bs_isol_1', {
      id: 'bs_isol_1',
      userId: ALICE,
      bookId: book.id,
      status: 'READ',
      addedAt: new Date(),
    });
    memDb.bookShelves.set('bs_isol_2', {
      id: 'bs_isol_2',
      userId: BOB,
      bookId: book.id,
      status: 'WANT',
      addedAt: new Date(),
    });

    const res = await request(app).get('/api/shelves/u/alice');
    expect(res.status).toBe(200);
    expect(res.body.shelves).toHaveLength(1);
    expect(res.body.shelves[0].status).toBe('READ');
  });

  it('잘못된 userId → 400', async () => {
    const res = await request(app).get('/api/shelves/u/..%2Fetc');
    // express path 디코드 결과에 따라 400 또는 404 — 어느 쪽이든 200/공개 노출은 X
    expect([400, 404]).toContain(res.status);
  });

  it('존재하지 않는 userId → 200 + 빈 배열 (privacy: 존재 여부 노출 X)', async () => {
    const res = await request(app).get('/api/shelves/u/ghost');
    expect(res.status).toBe(200);
    expect(res.body.shelves).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });
});
