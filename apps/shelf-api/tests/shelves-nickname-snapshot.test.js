/**
 * BookShelf.userNickname 스냅샷 (#561).
 *
 * 정책:
 *  - POST /api/shelves: JWT 의 nickname > name 으로 스냅샷 (없으면 null).
 *  - PATCH /api/shelves/:bookId: row 의 userNickname 이 null/빈문자열이면 backfill.
 *    (이미 있으면 덮어쓰지 X — 사용자가 nickname 바꿀 때 자동 동기화는 별도 PR.)
 *
 * hobby 의 `Post.ownerName` (#210) 패턴과 일치 — 다른 BE 가 auth DB 에 join 못함.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

import { authHeader, seedBook } from './helpers.js';

const ALICE = 'alice';

/** @type {import('express').Express} */
let app;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
  app = createApp({ rateLimitMax: 1000 });
});

describe('POST /api/shelves → userNickname 스냅샷', () => {
  it('JWT nickname 있으면 nickname 스냅샷', async () => {
    const book = await seedBook();
    const res = await request(app)
      .post('/api/shelves')
      .set(authHeader(ALICE, { nickname: '앨리스' }))
      .send({ bookId: book.id, status: 'WANT' });
    expect(res.status).toBe(201);

    const row = await prisma.bookShelf.findUnique({
      where: { userId_bookId: { userId: ALICE, bookId: book.id } },
    });
    expect(row.userNickname).toBe('앨리스');
  });

  it('JWT nickname 없고 name 만 있으면 name 스냅샷', async () => {
    const book = await seedBook();
    const res = await request(app)
      .post('/api/shelves')
      .set(authHeader(ALICE, { name: 'Alice Wonder' }))
      .send({ bookId: book.id, status: 'WANT' });
    expect(res.status).toBe(201);

    const row = await prisma.bookShelf.findUnique({
      where: { userId_bookId: { userId: ALICE, bookId: book.id } },
    });
    expect(row.userNickname).toBe('Alice Wonder');
  });

  it('빈 nickname → null 로 스냅샷 (browse 에서 자동 제외)', async () => {
    const book = await seedBook();
    const res = await request(app)
      .post('/api/shelves')
      .set(authHeader(ALICE, { nickname: '   ', name: '   ' }))
      .send({ bookId: book.id, status: 'WANT' });
    expect(res.status).toBe(201);

    const row = await prisma.bookShelf.findUnique({
      where: { userId_bookId: { userId: ALICE, bookId: book.id } },
    });
    expect(row.userNickname).toBeNull();
  });
});

describe('PATCH /api/shelves/:bookId → userNickname backfill', () => {
  it('row 의 userNickname null 이면 JWT 값으로 backfill', async () => {
    const book = await seedBook();
    await prisma.bookShelf.create({
      data: { userId: ALICE, bookId: book.id, status: 'READING', userNickname: null },
    });

    const res = await request(app)
      .patch(`/api/shelves/${book.id}`)
      .set(authHeader(ALICE, { nickname: '앨리스' }))
      .send({ status: 'READ' });
    expect(res.status).toBe(200);

    const row = await prisma.bookShelf.findUnique({
      where: { userId_bookId: { userId: ALICE, bookId: book.id } },
    });
    expect(row.userNickname).toBe('앨리스');
  });

  it('row 의 userNickname 이미 있으면 덮어쓰지 X (별도 PR 책임)', async () => {
    const book = await seedBook();
    await prisma.bookShelf.create({
      data: { userId: ALICE, bookId: book.id, status: 'READING', userNickname: '예전이름' },
    });

    const res = await request(app)
      .patch(`/api/shelves/${book.id}`)
      .set(authHeader(ALICE, { nickname: '새이름' }))
      .send({ status: 'READ' });
    expect(res.status).toBe(200);

    const row = await prisma.bookShelf.findUnique({
      where: { userId_bookId: { userId: ALICE, bookId: book.id } },
    });
    expect(row.userNickname).toBe('예전이름');
  });
});
