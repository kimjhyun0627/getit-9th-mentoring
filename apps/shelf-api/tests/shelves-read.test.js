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
  });

  it('빈 서재 → 200 + 빈 배열', async () => {
    const res = await request(app).get('/api/shelves/me').set(authHeader(ALICE));
    expect(res.status).toBe(200);
    expect(res.body.shelves).toEqual([]);
  });
});
