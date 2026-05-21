/**
 * GET /api/shelves/me/contains — lightweight ownership lookup (#477).
 *
 * 단일 (bookId/isbn) + 배치 (bookIds/isbns) 둘 다 검증.
 * 100건 myShelves 페이지 대신 O(1) lookup 으로 갈음.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

import { authHeader, seedBook } from './helpers.js';
import { memDb } from './setup.js';

const ALICE = 'alice';
const BOB = 'bob';

describe('GET /api/shelves/me/contains', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
    app = createApp({ rateLimitMax: 1000 });
  });

  const seedShelf = (userId, book) =>
    memDb.bookShelves.set(`bs_${userId}_${book.id}`, {
      id: `bs_${userId}_${book.id}`,
      userId,
      bookId: book.id,
      status: 'WANT',
      rating: null,
      review: null,
      addedAt: new Date('2026-05-15'),
      completedAt: null,
    });

  it('인증 없음 → 401', async () => {
    const res = await request(app).get('/api/shelves/me/contains?bookId=anything');
    expect(res.status).toBe(401);
  });

  it('bookId 단일 — 보유 시 contains=true + shelf 노출', async () => {
    const book = await seedBook({ isbn: '9788932917001', title: 'A' });
    seedShelf(ALICE, book);
    const res = await request(app)
      .get(`/api/shelves/me/contains?bookId=${book.id}`)
      .set(authHeader(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ bookId: book.id, contains: true });
    expect(res.body.shelf).toMatchObject({ bookId: book.id, status: 'WANT' });
  });

  it('bookId 단일 — 미보유 시 contains=false + shelf 미노출', async () => {
    const book = await seedBook({ isbn: '9788932917002', title: 'B' });
    const res = await request(app)
      .get(`/api/shelves/me/contains?bookId=${book.id}`)
      .set(authHeader(ALICE));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookId: book.id, contains: false });
  });

  it('isbn 단일 — 대소문자 무관 + 캐시 miss 시 contains=false', async () => {
    const book = await seedBook({ isbn: '9788932917003', title: 'C' });
    seedShelf(ALICE, book);
    const ok = await request(app)
      .get('/api/shelves/me/contains?isbn=9788932917003')
      .set(authHeader(ALICE));
    expect(ok.body).toMatchObject({ isbn: '9788932917003', contains: true });

    const miss = await request(app)
      .get('/api/shelves/me/contains?isbn=9999999999999')
      .set(authHeader(ALICE));
    expect(miss.status).toBe(200);
    expect(miss.body).toEqual({ isbn: '9999999999999', contains: false });
  });

  it('다른 유저 row 는 절대 노출 안 됨', async () => {
    const book = await seedBook({ isbn: '9788932917004', title: 'D' });
    seedShelf(BOB, book);
    const res = await request(app)
      .get(`/api/shelves/me/contains?bookId=${book.id}`)
      .set(authHeader(ALICE));
    expect(res.body).toEqual({ bookId: book.id, contains: false });
  });

  it('bookIds 배치 — 각 id 별 boolean map', async () => {
    const a = await seedBook({ isbn: '9788932917005', title: 'A' });
    const b = await seedBook({ isbn: '9788932917006', title: 'B' });
    const c = await seedBook({ isbn: '9788932917007', title: 'C' });
    seedShelf(ALICE, a);
    seedShelf(ALICE, c);
    const res = await request(app)
      .get(`/api/shelves/me/contains?bookIds=${a.id},${b.id},${c.id}`)
      .set(authHeader(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.contains).toEqual({ [a.id]: true, [b.id]: false, [c.id]: true });
  });

  it('isbns 배치 — 캐시 miss 는 false, 보유는 true', async () => {
    const a = await seedBook({ isbn: '9788932917010', title: 'A' });
    seedShelf(ALICE, a);
    const res = await request(app)
      .get('/api/shelves/me/contains?isbns=9788932917010,9999999999999')
      .set(authHeader(ALICE));
    expect(res.body.contains).toEqual({
      9788932917010: true,
      9999999999999: false,
    });
  });

  it('인자 없음 → 400', async () => {
    const res = await request(app).get('/api/shelves/me/contains').set(authHeader(ALICE));
    expect(res.status).toBe(400);
  });
});
