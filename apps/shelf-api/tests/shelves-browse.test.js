/**
 * GET /api/shelves/browse — 다른 부원 서재 둘러보기 (#561).
 *
 * 목적: shelf 자체에서 다른 사용자 서재 발견 경로 제공.
 *
 * 정책:
 *  - 비로그인이어도 200 (공개 디렉토리 — UserShelfPage 와 동일 트러스트 레벨).
 *  - nickname 스냅샷이 있는 사용자만 노출 (학교 인증 onboarding 완료자 + privacy).
 *  - 책 1권 이상 보유한 사용자만 노출 (group-by 자연 필터).
 *  - 책 권 수 (status 무관, READ/READING/WANT 합산) 만 노출. 책 목록 미노출.
 *  - sort: bookCount desc (default) / recent (latest addedAt) desc.
 *  - 페이지네이션: page/pageSize (max 100), total/page/pageSize 메타.
 *  - userId 는 화면에 그대로 들어감 (이미 /u/:userId 라우트 노출됨).
 */
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

import { createApp } from '../src/app.js';

import { seedBook } from './helpers.js';
import { memDb } from './setup.js';

const seedShelf = ({ id, userId, bookId, userNickname, addedAt, status = 'WANT' }) => {
  memDb.bookShelves.set(id, {
    id,
    userId,
    bookId,
    userNickname: userNickname ?? null,
    status,
    rating: null,
    review: null,
    addedAt: addedAt ?? new Date(),
    completedAt: null,
  });
};

describe('GET /api/shelves/browse (#561 부원 서재 디렉토리)', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
    app = createApp({ rateLimitMax: 1000 });
  });

  it('비로그인 → 200 + 빈 배열 (시드 없음)', async () => {
    const res = await request(app).get('/api/shelves/browse');
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20, total: 0 });
  });

  it('사용자별 책 권 수 집계 + nickname 노출', async () => {
    const b1 = await seedBook({ isbn: '9788932917245', title: 'A' });
    const b2 = await seedBook({ isbn: '9788937473135', title: 'B' });
    seedShelf({ id: 'bs1', userId: 'alice', bookId: b1.id, userNickname: '앨리스' });
    seedShelf({ id: 'bs2', userId: 'alice', bookId: b2.id, userNickname: '앨리스' });
    seedShelf({ id: 'bs3', userId: 'bob', bookId: b1.id, userNickname: 'Bobby' });

    const res = await request(app).get('/api/shelves/browse');
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    const alice = res.body.users.find((u) => u.userId === 'alice');
    const bob = res.body.users.find((u) => u.userId === 'bob');
    expect(alice).toMatchObject({ userId: 'alice', nickname: '앨리스', bookCount: 2 });
    expect(bob).toMatchObject({ userId: 'bob', nickname: 'Bobby', bookCount: 1 });
  });

  it('nickname 스냅샷 없는 사용자(userNickname=null) 제외', async () => {
    const b1 = await seedBook({ isbn: '9788932917245', title: 'A' });
    seedShelf({ id: 'bs1', userId: 'alice', bookId: b1.id, userNickname: '앨리스' });
    seedShelf({ id: 'bs2', userId: 'ghost', bookId: b1.id, userNickname: null });

    const res = await request(app).get('/api/shelves/browse');
    expect(res.status).toBe(200);
    const ids = res.body.users.map((u) => u.userId);
    expect(ids).toContain('alice');
    expect(ids).not.toContain('ghost');
  });

  it('빈 nickname 스냅샷도 제외 (공백 trim 후)', async () => {
    const b1 = await seedBook({ isbn: '9788932917245', title: 'A' });
    seedShelf({ id: 'bs1', userId: 'spaceman', bookId: b1.id, userNickname: '   ' });

    const res = await request(app).get('/api/shelves/browse');
    expect(res.status).toBe(200);
    expect(res.body.users.map((u) => u.userId)).not.toContain('spaceman');
  });

  it('default sort = bookCount desc', async () => {
    const b1 = await seedBook({ isbn: '9788932917245', title: 'A' });
    const b2 = await seedBook({ isbn: '9788937473135', title: 'B' });
    const b3 = await seedBook({ isbn: '9788954682152', title: 'C' });
    seedShelf({ id: 'bs1', userId: 'small', bookId: b1.id, userNickname: 'Small' });
    seedShelf({ id: 'bs2', userId: 'big', bookId: b1.id, userNickname: 'Big' });
    seedShelf({ id: 'bs3', userId: 'big', bookId: b2.id, userNickname: 'Big' });
    seedShelf({ id: 'bs4', userId: 'big', bookId: b3.id, userNickname: 'Big' });

    const res = await request(app).get('/api/shelves/browse');
    expect(res.status).toBe(200);
    expect(res.body.users[0].userId).toBe('big');
    expect(res.body.users[1].userId).toBe('small');
  });

  it('sort=recent → latest addedAt desc', async () => {
    const b1 = await seedBook({ isbn: '9788932917245', title: 'A' });
    seedShelf({
      id: 'bs1',
      userId: 'older',
      bookId: b1.id,
      userNickname: 'Older',
      addedAt: new Date('2026-01-01'),
    });
    seedShelf({
      id: 'bs2',
      userId: 'newer',
      bookId: b1.id,
      userNickname: 'Newer',
      addedAt: new Date('2026-05-20'),
    });

    const res = await request(app).get('/api/shelves/browse?sort=recent');
    expect(res.status).toBe(200);
    expect(res.body.users[0].userId).toBe('newer');
    expect(res.body.users[1].userId).toBe('older');
  });

  it('pagination — page/pageSize + total 정확', async () => {
    const b = await seedBook({ isbn: '9788932917245', title: 'A' });
    for (let i = 0; i < 5; i++) {
      seedShelf({
        id: `bs${i}`,
        userId: `u${i}`,
        bookId: b.id,
        userNickname: `User${i}`,
        addedAt: new Date(`2026-05-${10 + i}`),
      });
    }

    const res = await request(app).get('/api/shelves/browse?page=2&pageSize=2');
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 2, pageSize: 2, total: 5 });
  });

  it('pageSize 상한 100', async () => {
    const res = await request(app).get('/api/shelves/browse?pageSize=999');
    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(100);
  });

  it('잘못된 sort → 400', async () => {
    const res = await request(app).get('/api/shelves/browse?sort=garbage');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('응답에 책 목록(books) 없음 — privacy (책 권 수만 노출)', async () => {
    const b = await seedBook({ isbn: '9788932917245', title: 'A' });
    seedShelf({ id: 'bs1', userId: 'alice', bookId: b.id, userNickname: '앨리스' });

    const res = await request(app).get('/api/shelves/browse');
    expect(res.status).toBe(200);
    const alice = res.body.users[0];
    expect(alice.books).toBeUndefined();
    expect(alice.shelves).toBeUndefined();
  });
});
