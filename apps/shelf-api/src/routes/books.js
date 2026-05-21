/**
 * /api/books 라우터 — 도서 검색 + 상세.
 *
 * - GET /api/books/search?q=<keyword>
 *   외부 카카오 API 호출 → 응답을 Book 으로 upsert → items 반환.
 * - GET /api/books/:isbn
 *   캐시 hit + 신선(24h 이내) → 즉시 반환. 아니면 외부 재호출 후 upsert.
 *   외부 실패 + stale 캐시 존재 → graceful degrade 로 stale 반환.
 *
 * 책임 분리 (Wave 2 cleanup):
 *   - 캐시 TTL/신선도 → `lib/books/cache.js`
 *   - Kakao API + upsert 어댑터 → `lib/books/kakaoAdapter.js`
 *   - 응답 직렬화 → `lib/books/serialize.js`
 *   - 외부 fetch + raw 변환 → `lib/external/kakao.js`
 *
 * 에러 매핑:
 *   - 입력 검증 실패: 400 ValidationError
 *   - KAKAO_BOOK_API_KEY 미설정 + 캐시 미스: 503 ExternalApiUnavailable
 *   - 외부 API 4xx/5xx + 캐시 미스: 503 ExternalApiUnavailable
 *   - 외부 응답 비어있고 캐시 미스: 404 BookNotFound
 */
import { Router } from 'express';
import { z } from 'zod';

import { isFresh } from '../lib/books/cache.js';
import { isKakaoError, searchBooks, upsertBook } from '../lib/books/kakaoAdapter.js';
import { serializeBook } from '../lib/books/serialize.js';
import { prisma } from '../lib/prisma.js';

/**
 * `target` 검색 토글 (#202).
 * - 미지정: 카카오 기본(전체)
 * - title / person / publisher / isbn: 카카오 target 필드 그대로 전달
 *   isbn 은 ISBN-10 X 대문자 정규화까지 거친다.
 */
const SearchTarget = z.enum(['title', 'person', 'publisher', 'isbn']);

// 카카오 API cap: page 1~50, size 1~50 (그 이상은 카카오가 4xx 로 거절).
// 무한 스크롤(#527) 첫 페이지에 풍부함을 주려고 size 기본 30 — DB 순차 upsert
// 비용과 한 화면 채움의 균형점. page 기본 1.
const SearchPageParam = z.coerce.number().int().min(1).max(50);
const SearchSizeParam = z.coerce.number().int().min(1).max(50);

const SearchQuery = z.object({
  q: z.string().min(1, 'q is required').max(100, 'q too long'),
  target: SearchTarget.optional(),
  page: SearchPageParam.default(1),
  size: SearchSizeParam.default(30),
});

// ISBN 10/13 자리. 끝자리 X 는 대소문자 모두 받아 대문자로 정규화 — 캐시 키 일관성 (#224).
const IsbnParam = z.preprocess(
  (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  z.string().regex(/^(?:\d{10}|\d{9}X|\d{13})$/, 'invalid isbn'),
);

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
      const { page, size } = parsed.data;
      let records;
      let meta;
      try {
        ({ records, meta } = await searchBooks({
          query: queryNormalized,
          apiKey,
          target: parsed.data.target,
          page,
          size,
        }));
      } catch (err) {
        if (isKakaoError(err)) {
          req.log?.warn({ err }, 'kakao search failed');
          return res.status(503).json({ error: 'ExternalApiUnavailable' });
        }
        throw err;
      }

      // 순차 upsert — 페이지당 최대 50건이라 병렬 race 회피용으로 순차가 안전.
      const items = [];
      for (const record of records) {
        const saved = await upsertBook(record);
        items.push(serializeBook(saved, { cached: false }));
      }
      // #527: 무한 스크롤이 다음 페이지 존재를 판단하도록 page/size + meta 노출.
      return res.status(200).json({
        items,
        page,
        size,
        isEnd: meta.is_end,
        totalCount: meta.total_count,
      });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/books/:isbn/owners — 같은 책을 서재에 가진 유저 수 (#201, #292)
  // - 공개 카운트만 노출 (userId 목록은 노출 X — privacy)
  // - Book 캐시 없으면 404
  // - 캐시 hit 이지만 아무도 안 가지고 있으면 count=0
  router.get('/:isbn/owners', async (req, res, next) => {
    try {
      const isbnParse = IsbnParam.safeParse(req.params.isbn);
      if (!isbnParse.success) {
        return res.status(400).json({ error: 'ValidationError', message: 'invalid isbn' });
      }
      const isbn = isbnParse.data;
      const book = await prisma.book.findUnique({ where: { isbn } });
      if (!book) return res.status(404).json({ error: 'BookNotFound' });
      const count = await prisma.bookShelf.count({ where: { bookId: book.id } });
      return res.status(200).json({ isbn, count });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/books/:isbn/recommendations — 같은 작가 책 추천 (#209)
  // - 룰: Book.author 동일 + isbn ≠ 자기 자신 → 최대 8건
  // - 캐시 우선. 캐시에 작가 책이 적으면 외부 검색(target=person) 으로 보강
  // - 외부 실패해도 캐시 결과만 반환 (graceful)
  router.get('/:isbn/recommendations', async (req, res, next) => {
    try {
      const isbnParse = IsbnParam.safeParse(req.params.isbn);
      if (!isbnParse.success) {
        return res.status(400).json({ error: 'ValidationError', message: 'invalid isbn' });
      }
      const isbn = isbnParse.data;
      const seed = await prisma.book.findUnique({ where: { isbn } });
      if (!seed) return res.status(404).json({ error: 'BookNotFound' });

      // 작가 비어있으면 추천 불가 — 빈 배열.
      const author = (seed.author ?? '').trim();
      if (!author) return res.status(200).json({ isbn, author: '', items: [] });

      // 캐시에서 같은 작가 책 우선
      const cachedSameAuthor = await prisma.book.findMany({
        where: { author, isbn: { not: isbn } },
        orderBy: { cachedAt: 'desc' },
        take: 8,
      });

      // 부족하면 외부 보강 (best-effort).
      // CR #353: 4~7 권만 캐시되어 있을 때도 8 권 풀을 채우도록 < 8 로 (이전 < 4 는 underfill).
      const extras = [];
      if (cachedSameAuthor.length < 8) {
        const apiKey = process.env.KAKAO_BOOK_API_KEY ?? '';
        try {
          const { records } = await searchBooks({
            query: author,
            apiKey,
            target: 'person',
            size: 10,
          });
          const haveIsbns = new Set([isbn, ...cachedSameAuthor.map((b) => b.isbn)]);
          for (const r of records) {
            if (haveIsbns.has(r.isbn)) continue;
            try {
              const saved = await upsertBook(r);
              extras.push(saved);
              haveIsbns.add(r.isbn);
            } catch {
              // upsert 실패해도 다른 결과로 계속
            }
            if (cachedSameAuthor.length + extras.length >= 8) break;
          }
        } catch (err) {
          if (!isKakaoError(err)) throw err;
          req.log?.warn({ err, isbn }, 'kakao recommendations failed (best-effort)');
        }
      }

      const items = [...cachedSameAuthor, ...extras]
        .slice(0, 8)
        .map((row) => serializeBook(row, { cached: true }));
      return res.status(200).json({ isbn, author, items });
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
        return res.status(200).json({ book: serializeBook(cached, { cached: true }) });
      }

      // 캐시 만료 or 미스 → 외부 재호출
      const apiKey = process.env.KAKAO_BOOK_API_KEY ?? '';
      try {
        const { records } = await searchBooks({ query: isbn, apiKey, target: 'isbn', size: 1 });
        const record = records[0];
        if (record) {
          const saved = await upsertBook(record);
          return res.status(200).json({ book: serializeBook(saved, { cached: false }) });
        }
        // 외부 hit 0 + 캐시 있으면 stale 반환, 없으면 404
        if (cached) {
          return res
            .status(200)
            .json({ book: serializeBook(cached, { cached: true, stale: true }) });
        }
        return res.status(404).json({ error: 'BookNotFound' });
      } catch (err) {
        if (isKakaoError(err)) {
          req.log?.warn({ err, isbn }, 'kakao isbn lookup failed');
          // stale 이라도 있으면 반환, 없으면 503
          if (cached) {
            return res
              .status(200)
              .json({ book: serializeBook(cached, { cached: true, stale: true }) });
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
