/**
 * GET /api/books/:isbn/recommendations (#209) 통합 테스트.
 *
 * CR #353: books.test.js 300줄 제한 위반 → owners/recommendations 분리.
 */
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

import { memDb, mockKakaoPool } from './setup.js';

describe('GET /api/books/:isbn/recommendations', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    process.env.KAKAO_BOOK_API_KEY = 'test-kakao-key';
    app = createApp({ rateLimitMax: 1000 });
  });

  beforeEach(() => {
    const now = new Date();
    memDb.books.set('b_seed', {
      id: 'b_seed',
      isbn: '9788932917245',
      title: '소년이 온다',
      author: '한강',
      publisher: '창비',
      coverUrl: '',
      source: 'kakao',
      cachedAt: now,
    });
    memDb.books.set('b_same', {
      id: 'b_same',
      isbn: '9788936433598',
      title: '채식주의자',
      author: '한강',
      publisher: '창비',
      coverUrl: '',
      source: 'kakao',
      cachedAt: now,
    });
    memDb.books.set('b_other', {
      id: 'b_other',
      isbn: '9788954651288',
      title: '다른 책',
      author: '다른 작가',
      publisher: '문학동네',
      coverUrl: '',
      source: 'kakao',
      cachedAt: now,
    });
  });

  it('같은 작가의 다른 책 반환 (자기 자신 제외)', async () => {
    mockKakaoPool()
      .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
      .reply(200, { documents: [], meta: { total_count: 0 } });

    const res = await request(app).get('/api/books/9788932917245/recommendations');
    expect(res.status).toBe(200);
    expect(res.body.author).toBe('한강');
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    const isbns = res.body.items.map((i) => i.isbn);
    expect(isbns).toContain('9788936433598');
    expect(isbns).not.toContain('9788932917245');
    expect(isbns).not.toContain('9788954651288');
  });

  it('외부 API 실패해도 캐시 결과만 graceful 반환', async () => {
    mockKakaoPool()
      .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
      .reply(503, 'down');

    const res = await request(app).get('/api/books/9788932917245/recommendations');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('없는 isbn → 404', async () => {
    const res = await request(app).get('/api/books/9999999999999/recommendations');
    expect(res.status).toBe(404);
  });
});
