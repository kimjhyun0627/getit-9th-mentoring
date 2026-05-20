/**
 * /api/shelves POST/PATCH/DELETE (write) 통합 테스트.
 *
 * - POST: isbn/bookId 캐시 hit/miss, @@unique 충돌, 별점 범위 검증, 입력 누락, 404
 * - PATCH: 내 row 정상 수정 (completedAt 자동), 다른 유저 row 거부, 별점 범위, 빈 본문
 * - DELETE: 정상 삭제, 다른 유저 row 거부, 없는 row
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

import { authHeader, seedBook } from './helpers.js';
import { mockKakaoPool } from './setup.js';

const ALICE = 'alice';
const BOB = 'bob';

/** @type {import('express').Express} */
let app;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
  app = createApp({ rateLimitMax: 1000 });
});

describe('POST /api/shelves', () => {
  it('인증 없음 → 401', async () => {
    const res = await request(app).post('/api/shelves').send({ bookId: 'b_x' });
    expect(res.status).toBe(401);
  });

  it('bookId 캐시 hit → 201 + BookShelf 생성', async () => {
    const book = await seedBook();
    const res = await request(app)
      .post('/api/shelves')
      .set(authHeader(ALICE))
      .send({ bookId: book.id, status: 'WANT' });
    expect(res.status).toBe(201);
    expect(res.body.shelf).toMatchObject({ userId: ALICE, bookId: book.id, status: 'WANT' });
  });

  it('isbn 캐시 hit → 201 (외부 API 호출 없음)', async () => {
    const book = await seedBook({ isbn: '9788932917245' });
    const res = await request(app)
      .post('/api/shelves')
      .set(authHeader(ALICE))
      .send({ isbn: '9788932917245', status: 'WANT' });
    expect(res.status).toBe(201);
    expect(res.body.shelf.bookId).toBe(book.id);
  });

  it('isbn 캐시 miss → 외부 API → Book upsert → 201', async () => {
    mockKakaoPool()
      .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
      .reply(200, {
        documents: [
          {
            isbn: '8932917248 9788932917245',
            title: '소년이 온다',
            authors: ['한강'],
            publisher: '창비',
            datetime: '2014-05-19T00:00:00.000+09:00',
            thumbnail: 'https://example.com/c.jpg',
            contents: '광주 5·18',
          },
        ],
        meta: { total_count: 1 },
      });

    const res = await request(app)
      .post('/api/shelves')
      .set(authHeader(ALICE))
      .send({ isbn: '9788932917245', status: 'READING' });
    expect(res.status).toBe(201);
    expect(res.body.shelf.status).toBe('READING');
    const stored = await prisma.book.findUnique({ where: { isbn: '9788932917245' } });
    expect(stored).not.toBeNull();
  });

  it('@@unique(userId, bookId) 충돌 → 422', async () => {
    const book = await seedBook();
    await request(app)
      .post('/api/shelves')
      .set(authHeader(ALICE))
      .send({ bookId: book.id, status: 'WANT' });

    const res = await request(app)
      .post('/api/shelves')
      .set(authHeader(ALICE))
      .send({ bookId: book.id, status: 'WANT' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('ShelfAlreadyExists');
  });

  it('별점 -1 → 400', async () => {
    const book = await seedBook();
    const res = await request(app)
      .post('/api/shelves')
      .set(authHeader(ALICE))
      .send({ bookId: book.id, status: 'READ', rating: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('별점 6 → 400', async () => {
    const book = await seedBook();
    const res = await request(app)
      .post('/api/shelves')
      .set(authHeader(ALICE))
      .send({ bookId: book.id, status: 'READ', rating: 6 });
    expect(res.status).toBe(400);
  });

  it('isbn/bookId 모두 누락 → 400', async () => {
    const res = await request(app)
      .post('/api/shelves')
      .set(authHeader(ALICE))
      .send({ status: 'WANT' });
    expect(res.status).toBe(400);
  });

  it('존재하지 않는 bookId → 404', async () => {
    const res = await request(app)
      .post('/api/shelves')
      .set(authHeader(ALICE))
      .send({ bookId: 'nonexistent', status: 'WANT' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('BookNotFound');
  });
});

describe('PATCH /api/shelves/:bookId', () => {
  it('인증 없음 → 401', async () => {
    const res = await request(app).patch('/api/shelves/b_x').send({ status: 'READ' });
    expect(res.status).toBe(401);
  });

  it('내 row 정상 수정 → 200 + completedAt 자동 (status=READ 전환)', async () => {
    const book = await seedBook();
    await prisma.bookShelf.create({
      data: { userId: ALICE, bookId: book.id, status: 'READING' },
    });

    const res = await request(app)
      .patch(`/api/shelves/${book.id}`)
      .set(authHeader(ALICE))
      .send({ status: 'READ', rating: 5, review: '울림이 컸다' });
    expect(res.status).toBe(200);
    expect(res.body.shelf).toMatchObject({ status: 'READ', rating: 5, review: '울림이 컸다' });
    expect(res.body.shelf.completedAt).toBeTruthy();
  });

  it('다른 유저 row 수정 시도 → 404 (스코프 leak 방지)', async () => {
    const book = await seedBook();
    await prisma.bookShelf.create({
      data: { userId: BOB, bookId: book.id, status: 'WANT' },
    });
    const res = await request(app)
      .patch(`/api/shelves/${book.id}`)
      .set(authHeader(ALICE))
      .send({ status: 'READ' });
    expect(res.status).toBe(404);
  });

  it('별점 6 → 400', async () => {
    const book = await seedBook();
    await prisma.bookShelf.create({
      data: { userId: ALICE, bookId: book.id, status: 'READING' },
    });
    const res = await request(app)
      .patch(`/api/shelves/${book.id}`)
      .set(authHeader(ALICE))
      .send({ rating: 6 });
    expect(res.status).toBe(400);
  });

  it('status READ → READING 회귀 시 completedAt 만 null, rating/review 보존 (#218)', async () => {
    const book = await seedBook();
    await prisma.bookShelf.create({
      data: {
        userId: ALICE,
        bookId: book.id,
        status: 'READ',
        rating: 4,
        review: '인상 깊었다',
        completedAt: new Date(),
      },
    });

    const res = await request(app)
      .patch(`/api/shelves/${book.id}`)
      .set(authHeader(ALICE))
      .send({ status: 'READING' });
    expect(res.status).toBe(200);
    expect(res.body.shelf).toMatchObject({
      status: 'READING',
      rating: 4,
      review: '인상 깊었다',
    });
    expect(res.body.shelf.completedAt).toBeNull();
  });

  it('status READ → WANT 회귀 시에도 rating/review 보존', async () => {
    const book = await seedBook({ isbn: '9788932917999' });
    await prisma.bookShelf.create({
      data: {
        userId: ALICE,
        bookId: book.id,
        status: 'READ',
        rating: 5,
        review: '다시 읽고 싶다',
        completedAt: new Date(),
      },
    });

    const res = await request(app)
      .patch(`/api/shelves/${book.id}`)
      .set(authHeader(ALICE))
      .send({ status: 'WANT' });
    expect(res.status).toBe(200);
    expect(res.body.shelf.rating).toBe(5);
    expect(res.body.shelf.review).toBe('다시 읽고 싶다');
    expect(res.body.shelf.completedAt).toBeNull();
  });

  it('빈 본문 → 400 (refine 위반)', async () => {
    const book = await seedBook();
    await prisma.bookShelf.create({
      data: { userId: ALICE, bookId: book.id, status: 'WANT' },
    });
    const res = await request(app).patch(`/api/shelves/${book.id}`).set(authHeader(ALICE)).send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/shelves/:bookId', () => {
  it('인증 없음 → 401', async () => {
    const res = await request(app).delete('/api/shelves/b_x');
    expect(res.status).toBe(401);
  });

  it('내 row 정상 삭제 → 204', async () => {
    const book = await seedBook();
    await prisma.bookShelf.create({
      data: { userId: ALICE, bookId: book.id, status: 'WANT' },
    });
    const res = await request(app).delete(`/api/shelves/${book.id}`).set(authHeader(ALICE));
    expect(res.status).toBe(204);
    const remaining = await prisma.bookShelf.findFirst({
      where: { userId: ALICE, bookId: book.id },
    });
    expect(remaining).toBeNull();
  });

  it('다른 유저 row 삭제 시도 → 404 (스코프 leak 방지)', async () => {
    const book = await seedBook();
    await prisma.bookShelf.create({
      data: { userId: BOB, bookId: book.id, status: 'WANT' },
    });
    const res = await request(app).delete(`/api/shelves/${book.id}`).set(authHeader(ALICE));
    expect(res.status).toBe(404);
    const stillThere = await prisma.bookShelf.findFirst({
      where: { userId: BOB, bookId: book.id },
    });
    expect(stillThere).not.toBeNull();
  });

  it('없는 bookId 삭제 → 404', async () => {
    const res = await request(app).delete('/api/shelves/nonexistent').set(authHeader(ALICE));
    expect(res.status).toBe(404);
  });
});
