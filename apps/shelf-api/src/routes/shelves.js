/**
 * /api/shelves 라우터 — 내 서재 CRUD.
 *
 * 모든 엔드포인트는 부모 미들웨어로 requireAuth 통과 후 진입 → req.user.sub 가 userId.
 *
 * - GET    /me                내 서재 목록 (addedAt desc, Book 조인)
 * - POST   /                  책 추가 (isbn 또는 bookId)
 *                             · isbn 캐시 hit → 즉시 BookShelf.create
 *                             · isbn 캐시 miss → 외부 카카오 → Book.upsert → BookShelf.create
 *                             · @@unique(userId, bookId) 충돌 → 422
 * - PATCH  /:bookId           status / rating / review 수정 (내 row 만)
 * - DELETE /:bookId           내 서재에서 제거 (내 row 만)
 *
 * 권한 모델: WHERE 절에 userId 강제 결합 → 다른 유저 row 는 영원히 404.
 * 별점 0-5 정수 검증은 ShelfAddInput / ShelfUpdateInput 의 zod schema 가 강제.
 */
import { requireAuth } from '@getit/auth-utils/server';
import {
  SHELF_SORT_DEFAULT,
  ShelfAddInput,
  ShelfSortKey,
  ShelfUpdateInput,
} from '@getit/schemas/shelf';
import { Router } from 'express';

import {
  KakaoApiError,
  KakaoConfigError,
  searchKakaoBooks,
  toBookRecord,
} from '../lib/external/kakao.js';
import { prisma } from '../lib/prisma.js';
import { compareBy } from '../lib/shelf-sort.js';

/**
 * Zod 에러 → 400 응답 본문.
 *
 * @param {import('zod').ZodError} err
 */
const zodErrorBody = (err) => ({
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
const publicShelf = (row) => ({
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
 * isbn 으로 Book 조회/upsert — 캐시 hit 우선, miss 시 외부 카카오 호출.
 *
 * @param {string} isbn
 * @returns {Promise<{ status: number, book?: Record<string, any>, error?: string }>}
 */
const findOrFetchBookByIsbn = async (isbn) => {
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
const isUniqueViolation = (err) => err?.code === 'P2002';

/**
 * Shelves 라우터.
 *
 * @returns {import('express').Router}
 */
export const createShelvesRouter = () => {
  const router = Router();

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET env required');
  const auth = requireAuth({ secret: jwtSecret });

  router.use(auth);

  // GET /me — 내 서재 (page-based pagination: ?page=1&pageSize=20, 최대 100, sort=<key>)
  router.get('/me', async (req, res, next) => {
    try {
      const pageRaw = Number.parseInt(req.query.page, 10);
      const pageSizeRaw = Number.parseInt(req.query.pageSize, 10);
      const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
      const pageSize =
        Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1 ? Math.min(pageSizeRaw, 100) : 20;
      const skip = (page - 1) * pageSize;

      // sort 미지정 → 기본값. 명시되었으면 enum 검증. 배열 입력은 400 거절.
      const sortParam = req.query.sort;
      let sort = SHELF_SORT_DEFAULT;
      if (sortParam !== undefined) {
        if (typeof sortParam !== 'string' || sortParam.length === 0) {
          return res.status(400).json({
            error: 'ValidationError',
            issues: [{ path: 'sort', message: 'unsupported sort key' }],
          });
        }
        const parsed = ShelfSortKey.safeParse(sortParam);
        if (!parsed.success) {
          return res.status(400).json({
            error: 'ValidationError',
            issues: [{ path: 'sort', message: 'unsupported sort key' }],
          });
        }
        sort = parsed.data;
      }

      const where = { userId: req.user.sub };
      // 전체 row 를 가져와서 정렬한 뒤 페이지를 자른다. Prisma orderBy 만으론
      // nullsLast / book.title 정렬을 일관되게 표현하기 어렵고, 페이지를 먼저 자르면
      // 전역 정렬이 깨진다. 서재 행수는 사용자당 수백 건 이내 가정 (heavy-user 는
      // 별도 pageSize 상한 + lightweight bookIds 엔드포인트로 대응).
      const all = await prisma.bookShelf.findMany({
        where,
        include: { book: true },
      });
      const sorted = [...all].sort(compareBy(sort));
      const paged = sorted.slice(skip, skip + pageSize);
      return res.status(200).json({
        shelves: paged.map(publicShelf),
        pagination: { page, pageSize, total: all.length, sort },
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST / — 책 추가
  router.post('/', async (req, res, next) => {
    try {
      const parsed = ShelfAddInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const { isbn, bookId, status, rating, review } = parsed.data;

      // Book 확보
      let book = null;
      if (bookId) {
        book = await prisma.book.findUnique({ where: { id: bookId } });
        if (!book) return res.status(404).json({ error: 'BookNotFound' });
      } else {
        const result = await findOrFetchBookByIsbn(isbn);
        if (!result.book) return res.status(result.status).json({ error: result.error });
        book = result.book;
      }

      // BookShelf.create — unique 충돌 → 422
      try {
        const created = await prisma.bookShelf.create({
          data: {
            userId: req.user.sub,
            bookId: book.id,
            status,
            rating: rating ?? null,
            review: review ?? null,
            completedAt: status === 'READ' ? new Date() : null,
          },
          include: { book: true },
        });
        return res.status(201).json({ shelf: publicShelf(created) });
      } catch (err) {
        if (isUniqueViolation(err)) {
          return res.status(422).json({ error: 'ShelfAlreadyExists' });
        }
        throw err;
      }
    } catch (err) {
      return next(err);
    }
  });

  // PATCH /:bookId — 내 row 만 수정
  router.patch('/:bookId', async (req, res, next) => {
    try {
      const parsed = ShelfUpdateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const userId = req.user.sub;
      const { bookId } = req.params;

      const existing = await prisma.bookShelf.findUnique({
        where: { userId_bookId: { userId, bookId } },
      });
      if (!existing) return res.status(404).json({ error: 'ShelfNotFound' });

      // status=READ 전환 시 completedAt 자동 설정 (이미 READ였으면 유지)
      const nextStatus = parsed.data.status ?? existing.status;
      const completedAt =
        parsed.data.status === 'READ' && existing.status !== 'READ'
          ? new Date()
          : parsed.data.status && parsed.data.status !== 'READ'
            ? null
            : existing.completedAt;

      const updated = await prisma.bookShelf.update({
        where: { userId_bookId: { userId, bookId } },
        data: {
          ...parsed.data,
          status: nextStatus,
          completedAt,
        },
        include: { book: true },
      });
      return res.status(200).json({ shelf: publicShelf(updated) });
    } catch (err) {
      return next(err);
    }
  });

  // DELETE /:bookId — 내 row 만 삭제
  router.delete('/:bookId', async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const { bookId } = req.params;

      const existing = await prisma.bookShelf.findUnique({
        where: { userId_bookId: { userId, bookId } },
      });
      if (!existing) return res.status(404).json({ error: 'ShelfNotFound' });

      await prisma.bookShelf.delete({
        where: { userId_bookId: { userId, bookId } },
      });
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
