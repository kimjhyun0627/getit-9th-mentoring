/**
 * /api/books 라우터 — 도서 검색 + 상세.
 *
 * - GET /api/books/search?q=<keyword>
 *   외부 카카오 API 호출 → 응답을 Book 으로 upsert → items 반환.
 * - GET /api/books/:isbn
 *   캐시 hit + 신선(24h 이내) → 즉시 반환. 아니면 외부 재호출 후 upsert.
 *   외부 실패 + stale 캐시 존재 → graceful degrade 로 stale 반환.
 *
 * 에러 매핑:
 *   - 입력 검증 실패: 400 ValidationError
 *   - KAKAO_BOOK_API_KEY 미설정 + 캐시 미스: 503 ExternalApiUnavailable
 *   - 외부 API 4xx/5xx + 캐시 미스: 503 ExternalApiUnavailable
 *   - 외부 응답 비어있고 캐시 미스: 404 BookNotFound
 */
import { Router } from 'express';
import { z } from 'zod';

import {
  KakaoApiError,
  KakaoConfigError,
  searchKakaoBooks,
  toBookRecord,
} from '../lib/external/kakao.js';
import { prisma } from '../lib/prisma.js';

/**
 * `target` 검색 토글 (#202).
 * - 미지정: 카카오 기본(전체)
 * - title / person / publisher / isbn: 카카오 target 필드 그대로 전달
 *   isbn 은 ISBN-10 X 대문자 정규화까지 거친다.
 */
const SearchTarget = z.enum(['title', 'person', 'publisher', 'isbn']);

const SearchQuery = z.object({
  q: z.string().min(1, 'q is required').max(100, 'q too long'),
  target: SearchTarget.optional(),
});

// ISBN 10/13 자리. 끝자리 X 는 대소문자 모두 받아 대문자로 정규화 — 캐시 키 일관성 (#224).
const IsbnParam = z.preprocess(
  (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  z.string().regex(/^(?:\d{10}|\d{9}X|\d{13})$/, 'invalid isbn'),
);

const DEFAULT_TTL_HOURS = 24;

/**
 * 모듈 로드 시점에 한 번만 계산하는 캐시 TTL (ms).
 * 환경변수 `BOOK_CACHE_TTL_HOURS` 기반, 음수/NaN 은 기본값으로.
 */
const BOOK_CACHE_TTL_MS = (() => {
  const raw = process.env.BOOK_CACHE_TTL_HOURS;
  const n = Number.parseInt(raw ?? '', 10);
  const hours = Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_HOURS;
  return hours * 60 * 60 * 1000;
})();

/**
 * 캐시 row 가 신선한지 (cachedAt + TTL > now).
 * Prisma 는 DateTime 을 Date 객체로 반환하므로 `getTime()` 만 호출.
 *
 * @param {{ cachedAt: Date }} row
 * @returns {boolean}
 */
const isFresh = (row) => {
  return Date.now() - row.cachedAt.getTime() < BOOK_CACHE_TTL_MS;
};

/**
 * DB row → 응답 JSON. cached/stale flag 부착.
 *
 * @param {Record<string, any>} row
 * @param {{ cached: boolean, stale?: boolean }} flags
 * @returns {Record<string, any>}
 */
const toResponseBook = (row, flags) => ({
  isbn: row.isbn,
  title: row.title,
  author: row.author,
  publisher: row.publisher,
  publishedAt: row.publishedAt,
  coverUrl: row.coverUrl,
  description: row.description,
  source: row.source,
  cachedAt: row.cachedAt,
  cached: flags.cached,
  stale: flags.stale ?? false,
});

/**
 * Book 도메인 객체를 Prisma upsert. cachedAt 은 prisma `@updatedAt` 으로 자동 갱신.
 *
 * @param {ReturnType<typeof toBookRecord>} record
 */
const upsertBook = (record) =>
  prisma.book.upsert({
    where: { isbn: record.isbn },
    create: record,
    update: {
      title: record.title,
      author: record.author,
      publisher: record.publisher,
      publishedAt: record.publishedAt,
      coverUrl: record.coverUrl,
      description: record.description,
      source: record.source,
    },
  });

/**
 * 도서 라우터 생성.
 *
 * @returns {import('express').Router}
 */
export const createBooksRouter = () => {
  const router = Router();

  // GET /api/books/search?q=<keyword>
  router.get('/search', async (req, res, next) => {
    try {
      const parsed = SearchQuery.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'ValidationError',
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        });
      }

      const apiKey = process.env.KAKAO_BOOK_API_KEY ?? '';
      // target=isbn 인 경우 입력값을 대문자로 정규화 (캐시 키 #224 와 동일 규칙)
      const queryNormalized =
        parsed.data.target === 'isbn' ? parsed.data.q.toUpperCase() : parsed.data.q;
      let docs;
      try {
        docs = await searchKakaoBooks({
          query: queryNormalized,
          apiKey,
          target: parsed.data.target,
        });
      } catch (err) {
        if (err instanceof KakaoConfigError || err instanceof KakaoApiError) {
          req.log?.warn({ err }, 'kakao search failed');
          return res.status(503).json({ error: 'ExternalApiUnavailable' });
        }
        throw err;
      }

      const records = docs.map(toBookRecord).filter(Boolean);
      // 순차 upsert — 검색 결과는 보통 ≤10건이라 병렬 race 회피용으로 순차가 안전.
      const items = [];
      for (const record of records) {
        const saved = await upsertBook(record);
        items.push(toResponseBook(saved, { cached: false }));
      }
      return res.status(200).json({ items });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/books/:isbn
  router.get('/:isbn', async (req, res, next) => {
    try {
      const isbnParse = IsbnParam.safeParse(req.params.isbn);
      if (!isbnParse.success) {
        return res.status(400).json({ error: 'ValidationError', message: 'invalid isbn' });
      }
      const isbn = isbnParse.data;
      const cached = await prisma.book.findUnique({ where: { isbn } });

      if (cached && isFresh(cached)) {
        return res.status(200).json({ book: toResponseBook(cached, { cached: true }) });
      }

      // 캐시 만료 or 미스 → 외부 재호출
      const apiKey = process.env.KAKAO_BOOK_API_KEY ?? '';
      try {
        const docs = await searchKakaoBooks({ query: isbn, apiKey, target: 'isbn', size: 1 });
        const record = docs.map(toBookRecord).find(Boolean);
        if (record) {
          const saved = await upsertBook(record);
          return res.status(200).json({ book: toResponseBook(saved, { cached: false }) });
        }
        // 외부 hit 0 + 캐시 있으면 stale 반환, 없으면 404
        if (cached) {
          return res
            .status(200)
            .json({ book: toResponseBook(cached, { cached: true, stale: true }) });
        }
        return res.status(404).json({ error: 'BookNotFound' });
      } catch (err) {
        if (err instanceof KakaoConfigError || err instanceof KakaoApiError) {
          req.log?.warn({ err, isbn }, 'kakao isbn lookup failed');
          // stale 이라도 있으면 반환, 없으면 503
          if (cached) {
            return res
              .status(200)
              .json({ book: toResponseBook(cached, { cached: true, stale: true }) });
          }
          return res.status(503).json({ error: 'ExternalApiUnavailable' });
        }
        throw err;
      }
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
