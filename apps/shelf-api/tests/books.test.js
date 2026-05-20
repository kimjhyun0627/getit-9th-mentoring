/**
 * /api/books/search + /api/books/:isbn 통합 테스트 (supertest + undici MockAgent).
 *
 * - search: 정상 / Book upsert / 같은 isbn 재검색 시 캐시 갱신 / 외부 API 503 / 키 부재 503
 * - detail: 캐시 hit / 만료 시 외부 재호출 / 외부 실패 시 stale 캐시 fallback / 미존재 isbn 404
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

import { memDb, mockKakaoPool } from './setup.js';

const docKr = {
  isbn: '8932917248 9788932917245',
  title: '소년이 온다',
  authors: ['한강'],
  publisher: '창비',
  datetime: '2014-05-19T00:00:00.000+09:00',
  thumbnail: 'https://example.com/cover.jpg',
  contents: '5·18 광주 민주화 운동을 다룬 소설',
};

describe('shelf-api books routes', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(() => {
    process.env.KAKAO_BOOK_API_KEY = 'test-kakao-key';
    app = createApp({ rateLimitMax: 1000 });
  });

  describe('GET /api/health', () => {
    it('200 OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.service).toBe('shelf-api');
    });
  });

  describe('GET /api/books/search', () => {
    it('q 누락 → 400', async () => {
      const res = await request(app).get('/api/books/search');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('정상 검색 → 외부 API 호출 + Book upsert + items 반환', async () => {
      mockKakaoPool()
        .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
        .reply(200, { documents: [docKr], meta: { total_count: 1 } });

      const res = await request(app).get('/api/books/search').query({ q: '소년이 온다' });
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        isbn: '9788932917245',
        title: '소년이 온다',
        author: '한강',
        publisher: '창비',
        source: 'kakao',
      });

      // DB upsert 확인
      const stored = await prisma.book.findUnique({ where: { isbn: '9788932917245' } });
      expect(stored).not.toBeNull();
      expect(stored.title).toBe('소년이 온다');
    });

    it('같은 isbn 재검색 시 외부 API 응답 재upsert (cachedAt 갱신, row 1개 유지)', async () => {
      // 두 번 호출되도록 두 번 등록.
      mockKakaoPool()
        .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
        .reply(200, { documents: [docKr], meta: { total_count: 1 } })
        .times(2);

      await request(app).get('/api/books/search').query({ q: '소년이 온다' });
      const first = await prisma.book.findUnique({ where: { isbn: '9788932917245' } });
      const firstCachedAt = first.cachedAt;

      // 작은 텀 강제
      await new Promise((resolve) => setTimeout(resolve, 5));

      await request(app).get('/api/books/search').query({ q: '소년이 온다' });
      const second = await prisma.book.findUnique({ where: { isbn: '9788932917245' } });
      expect(second.cachedAt.getTime()).toBeGreaterThanOrEqual(firstCachedAt.getTime());
      // 같은 isbn 으로 row 1개만 존재해야 함 (unique 보장)
      expect(memDb.books.size).toBe(1);
    });

    it('API 키 미설정 → 503', async () => {
      const original = process.env.KAKAO_BOOK_API_KEY;
      process.env.KAKAO_BOOK_API_KEY = '';
      try {
        const noKeyApp = createApp({ rateLimitMax: 1000 });
        const res = await request(noKeyApp).get('/api/books/search').query({ q: '책' });
        expect(res.status).toBe(503);
        expect(res.body.error).toBe('ExternalApiUnavailable');
      } finally {
        process.env.KAKAO_BOOK_API_KEY = original;
      }
    });

    it('외부 API 5xx → 503 fallback', async () => {
      mockKakaoPool()
        .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
        .reply(503, 'Service Unavailable');

      const res = await request(app).get('/api/books/search').query({ q: '책' });
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('ExternalApiUnavailable');
    });

    it('외부 API 4xx (잘못된 키) → 503 (서버 운영 이슈로 마스킹)', async () => {
      mockKakaoPool()
        .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
        .reply(401, { message: 'invalid' });

      const res = await request(app).get('/api/books/search').query({ q: '책' });
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('ExternalApiUnavailable');
    });
  });

  describe('GET /api/books/:isbn', () => {
    beforeEach(async () => {
      // 시드: 신선한 캐시 1건
      await prisma.book.upsert({
        where: { isbn: '9788932917245' },
        create: {
          isbn: '9788932917245',
          title: '소년이 온다',
          author: '한강',
          publisher: '창비',
          publishedAt: new Date('2014-05-19'),
          coverUrl: 'https://example.com/cover.jpg',
          description: '광주 5·18',
          source: 'kakao',
        },
        update: {},
      });
    });

    it('isbn 형식 위반 → 400', async () => {
      const res = await request(app).get('/api/books/not-an-isbn!');
      expect(res.status).toBe(400);
    });

    it('캐시 hit + 신선 → 외부 호출 없이 200', async () => {
      // 외부 mock 미등록 → 호출 발생 시 throw
      const res = await request(app).get('/api/books/9788932917245');
      expect(res.status).toBe(200);
      expect(res.body.book).toMatchObject({
        isbn: '9788932917245',
        title: '소년이 온다',
        cached: true,
      });
    });

    it('캐시 만료 (cachedAt > 24h) → 외부 재호출 + 갱신', async () => {
      // 캐시 cachedAt 을 25h 전으로 강제
      const past = new Date(Date.now() - 25 * 60 * 60 * 1000);
      for (const [id, b] of memDb.books) {
        memDb.books.set(id, { ...b, cachedAt: past });
      }

      mockKakaoPool()
        .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
        .reply(200, {
          documents: [{ ...docKr, contents: '갱신된 설명' }],
          meta: { total_count: 1 },
        });

      const res = await request(app).get('/api/books/9788932917245');
      expect(res.status).toBe(200);
      expect(res.body.book.description).toBe('갱신된 설명');
      expect(res.body.book.cached).toBe(false);
    });

    it('캐시 없음 + 외부 hit → 200 + Book upsert', async () => {
      memDb.books.clear();

      mockKakaoPool()
        .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
        .reply(200, { documents: [docKr], meta: { total_count: 1 } });

      const res = await request(app).get('/api/books/9788932917245');
      expect(res.status).toBe(200);
      expect(res.body.book.title).toBe('소년이 온다');
      expect(res.body.book.cached).toBe(false);

      const stored = await prisma.book.findUnique({ where: { isbn: '9788932917245' } });
      expect(stored).not.toBeNull();
    });

    it('캐시 없음 + 외부 miss → 404', async () => {
      memDb.books.clear();

      mockKakaoPool()
        .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
        .reply(200, { documents: [], meta: { total_count: 0 } });

      const res = await request(app).get('/api/books/9999999999999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('BookNotFound');
    });

    it('캐시 만료 + 외부 실패 → stale 캐시 그대로 반환 (graceful degrade)', async () => {
      const past = new Date(Date.now() - 25 * 60 * 60 * 1000);
      for (const [id, b] of memDb.books) {
        memDb.books.set(id, { ...b, cachedAt: past });
      }

      mockKakaoPool()
        .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
        .reply(503, 'Service Unavailable');

      const res = await request(app).get('/api/books/9788932917245');
      expect(res.status).toBe(200);
      expect(res.body.book.cached).toBe(true);
      expect(res.body.book.stale).toBe(true);
    });

    it('캐시 없음 + 키 미설정 → 503', async () => {
      memDb.books.clear();
      const original = process.env.KAKAO_BOOK_API_KEY;
      process.env.KAKAO_BOOK_API_KEY = '';
      try {
        const noKeyApp = createApp({ rateLimitMax: 1000 });
        const res = await request(noKeyApp).get('/api/books/9788932917245');
        expect(res.status).toBe(503);
        expect(res.body.error).toBe('ExternalApiUnavailable');
      } finally {
        process.env.KAKAO_BOOK_API_KEY = original;
      }
    });
  });
});
