/**
 * /api/shelves 라우터의 직렬화·검증 헬퍼.
 *
 * 라우터 본체(라인 수 제한 300줄)를 비대해지지 않게 외부 모듈로 분리.
 */
import { SHELF_SORT_DEFAULT, ShelfSortKey } from '@getit/schemas/shelf';

import {
  KakaoApiError,
  KakaoConfigError,
  searchKakaoBooks,
  toBookRecord,
} from '../lib/external/kakao.js';
import { prisma } from '../lib/prisma.js';

/**
 * Zod 에러 → 400 응답 본문.
 *
 * @param {import('zod').ZodError} err
 */
export const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

/**
 * 응답용 BookShelf 직렬화 (book 동봉 옵션).
 *
 * `i_added` — 이 row 가 "내 서재에 담겨 있음" 을 명시. GET /me 응답은 항상 내 서재 row 이므로
 * 항상 true. SearchPage (#217) 가 새로고침 후에도 cross-reference 로 추가 여부 판정 가능.
 *
 * @param {Record<string, any>} row
 */
export const publicShelf = (row) => ({
  id: row.id,
  userId: row.userId,
  bookId: row.bookId,
  status: row.status,
  rating: row.rating ?? null,
  review: row.review ?? null,
  addedAt: row.addedAt,
  completedAt: row.completedAt ?? null,
  i_added: true,
  book: row.book ? { ...row.book } : undefined,
});

/**
 * 공개 응답용 BookShelf 직렬화 — userId/i_added 제거 (#292).
 *
 * @param {Record<string, any>} row
 */
export const publicReadOnlyShelf = (row) => ({
  id: row.id,
  bookId: row.bookId,
  status: row.status,
  rating: row.rating ?? null,
  review: row.review ?? null,
  addedAt: row.addedAt,
  completedAt: row.completedAt ?? null,
  book: row.book ? { ...row.book } : undefined,
});

/**
 * 쿼리스트링에서 page/pageSize/sort 파싱 — /me 와 /u/:userId 가 공유.
 *
 * @param {Record<string, any>} query
 * @returns {{ ok: true, page: number, pageSize: number, skip: number, sort: string }
 *   | { ok: false, body: any }}
 */
export const parseListQuery = (query) => {
  const pageRaw = Number.parseInt(query.page, 10);
  const pageSizeRaw = Number.parseInt(query.pageSize, 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1 ? Math.min(pageSizeRaw, 100) : 20;
  const skip = (page - 1) * pageSize;

  const sortParam = query.sort;
  let sort = SHELF_SORT_DEFAULT;
  if (sortParam !== undefined) {
    if (typeof sortParam !== 'string' || sortParam.length === 0) {
      return {
        ok: false,
        body: {
          error: 'ValidationError',
          issues: [{ path: 'sort', message: 'unsupported sort key' }],
        },
      };
    }
    const parsed = ShelfSortKey.safeParse(sortParam);
    if (!parsed.success) {
      return {
        ok: false,
        body: {
          error: 'ValidationError',
          issues: [{ path: 'sort', message: 'unsupported sort key' }],
        },
      };
    }
    sort = parsed.data;
  }
  return { ok: true, page, pageSize, skip, sort };
};

/**
 * isbn 으로 Book 조회/upsert — 캐시 hit 우선, miss 시 외부 카카오 호출.
 *
 * @param {string} isbn
 * @returns {Promise<{ status: number, book?: Record<string, any>, error?: string }>}
 */
export const findOrFetchBookByIsbn = async (isbn) => {
  const cached = await prisma.book.findUnique({ where: { isbn } });
  if (cached) return { status: 200, book: cached };

  const apiKey = process.env.KAKAO_BOOK_API_KEY ?? '';
  try {
    const docs = await searchKakaoBooks({ query: isbn, apiKey, target: 'isbn', size: 1 });
    const record = docs.map(toBookRecord).find(Boolean);
    if (!record) return { status: 404, error: 'BookNotFound' };
    const saved = await prisma.book.upsert({
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
    return { status: 201, book: saved };
  } catch (err) {
    if (err instanceof KakaoConfigError || err instanceof KakaoApiError) {
      return { status: 503, error: 'ExternalApiUnavailable' };
    }
    throw err;
  }
};

/**
 * Prisma P2002 (unique constraint violation) 에러 판별.
 *
 * `PrismaClientKnownRequestError` name 만으로 판별하면 P2025 (record not found),
 * P2003 (FK violation) 등 다른 known error 까지 unique 충돌로 오해됨 → code 만 확인.
 *
 * @param {any} err
 * @returns {boolean}
 */
export const isUniqueViolation = (err) => err?.code === 'P2002';
