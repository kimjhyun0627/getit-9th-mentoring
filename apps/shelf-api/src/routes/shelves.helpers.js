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

/**
 * GET /api/shelves/me/contains 핸들러 (#477).
 *
 * lightweight ownership lookup — bookId / isbn / bookIds / isbns 중 하나로
 * 내가 책을 보유 중인지 단일 또는 배치 (최대 50) 응답.
 *
 * 100건 myShelves 페이지 한계 회피용. 실 Prisma + in-memory fake 모두에서
 * 안전하게 동작하도록 nested where 대신 ISBN → bookId 2-step lookup.
 *
 * @param {string} userId — 인증된 사용자 sub
 * @param {Record<string, any>} query — req.query
 * @returns {Promise<{ status: number, body: Record<string, any> }>}
 */
export const handleContainsLookup = async (userId, query) => {
  const { bookId, isbn, bookIds, isbns } = query;

  const BATCH_MAX = 50;
  const splitCsv = (v) =>
    typeof v === 'string'
      ? v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  if (typeof bookId === 'string' && bookId) {
    const row = await prisma.bookShelf.findUnique({
      where: { userId_bookId: { userId, bookId } },
      include: { book: true },
    });
    return {
      status: 200,
      body: { bookId, contains: Boolean(row), shelf: row ? publicShelf(row) : undefined },
    };
  }

  if (typeof isbn === 'string' && isbn) {
    const upper = isbn.toUpperCase();
    const book = await prisma.book.findUnique({ where: { isbn: upper } });
    if (!book) return { status: 200, body: { isbn: upper, contains: false } };
    const row = await prisma.bookShelf.findUnique({
      where: { userId_bookId: { userId, bookId: book.id } },
      include: { book: true },
    });
    return {
      status: 200,
      body: {
        isbn: upper,
        contains: Boolean(row),
        shelf: row ? publicShelf(row) : undefined,
      },
    };
  }

  const ids = splitCsv(bookIds);
  if (ids.length > BATCH_MAX) {
    return {
      status: 400,
      body: { error: 'ValidationError', message: `bookIds exceeds ${BATCH_MAX}` },
    };
  }
  if (ids.length > 0) {
    const rows = await prisma.bookShelf.findMany({
      where: { userId, bookId: { in: ids } },
      select: { bookId: true },
    });
    const set = new Set(rows.map((r) => r.bookId));
    return {
      status: 200,
      body: { contains: Object.fromEntries(ids.map((id) => [id, set.has(id)])) },
    };
  }

  const isbnList = splitCsv(isbns).map((s) => s.toUpperCase());
  if (isbnList.length > BATCH_MAX) {
    return {
      status: 400,
      body: { error: 'ValidationError', message: `isbns exceeds ${BATCH_MAX}` },
    };
  }
  if (isbnList.length > 0) {
    const books = await prisma.book.findMany({ where: { isbn: { in: isbnList } } });
    const isbnToId = new Map(books.map((b) => [b.isbn, b.id]));
    const ownedIds = isbnToId.size
      ? await prisma.bookShelf.findMany({
          where: { userId, bookId: { in: [...isbnToId.values()] } },
          select: { bookId: true },
        })
      : [];
    const ownedIdSet = new Set(ownedIds.map((r) => r.bookId));
    return {
      status: 200,
      body: {
        contains: Object.fromEntries(
          isbnList.map((v) => {
            const id = isbnToId.get(v);
            return [v, id ? ownedIdSet.has(id) : false];
          }),
        ),
      },
    };
  }

  return {
    status: 400,
    body: {
      error: 'ValidationError',
      message: 'one of bookId / isbn / bookIds / isbns is required',
    },
  };
};
