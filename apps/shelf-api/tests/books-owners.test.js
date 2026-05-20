/**
 * GET /api/books/:isbn/owners (#201, #292) 통합 테스트.
 *
 * CR #353: books.test.js 300줄 제한 위반 → owners/recommendations 분리.
 */
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

import { memDb } from './setup.js';

describe('GET /api/books/:isbn/owners', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    process.env.KAKAO_BOOK_API_KEY = 'test-kakao-key';
    app = createApp({ rateLimitMax: 1000 });
  });

  beforeEach(() => {
    memDb.books.set('b_1', {
      id: 'b_1',
      isbn: '9788932917245',
      title: '소년이 온다',
      author: '한강',
      publisher: '창비',
      coverUrl: '',
      source: 'kakao',
      cachedAt: new Date(),
    });
    memDb.bookShelves.set('bs_1', {
      id: 'bs_1',
      userId: 'u_a',
      bookId: 'b_1',
      status: 'READ',
      addedAt: new Date(),
    });
    memDb.bookShelves.set('bs_2', {
      id: 'bs_2',
      userId: 'u_b',
      bookId: 'b_1',
      status: 'WANT',
      addedAt: new Date(),
    });
  });

  it('서재에 책 가진 유저 카운트', async () => {
    const res = await request(app).get('/api/books/9788932917245/owners');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ isbn: '9788932917245', count: 2 });
  });

  it('없는 isbn → 404', async () => {
    const res = await request(app).get('/api/books/9999999999999/owners');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('BookNotFound');
  });

  it('잘못된 isbn → 400', async () => {
    const res = await request(app).get('/api/books/not-isbn/owners');
    expect(res.status).toBe(400);
  });
});
