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
import { zodErrorBody } from '@getit/schemas/errors';
import { ShelfAddInput, ShelfUpdateInput } from '@getit/schemas/shelf';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { compareBy } from '../lib/shelf-sort.js';

import {
  aggregateByUser,
  parseBrowseQuery,
  publicBrowseUser,
  sortUsers,
} from './shelves.browse.js';
import {
  findOrFetchBookByIsbn,
  handleContainsLookup,
  isUniqueViolation,
  parseListQuery,
  publicReadOnlyShelf,
  publicShelf,
} from './shelves.helpers.js';

/**
 * JWT payload 에서 nickname 스냅샷 값 결정 (#561).
 * - nickname > name 우선.
 * - trim 후 비어있으면 null (BookShelf.userNickname 이 nullable).
 *
 * @param {{ nickname?: string | null, name?: string | null } | null | undefined} user
 * @returns {string | null}
 */
const snapshotNickname = (user) => {
  if (!user || typeof user !== 'object') return null;
  const candidates = [user.nickname, user.name];
  for (const v of candidates) {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
};

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

  // GET /browse — 부원 서재 디렉토리 (#561)
  // - 공개. UserShelfPage 와 동일 트러스트.
  // - userNickname 스냅샷 있는 user 만 노출 + 책 1권 이상 필터 자동.
  // - sort = bookCount (default) / recent.
  // - 페이지네이션: page/pageSize (max 100).
  router.get('/browse', async (req, res, next) => {
    try {
      const parsed = parseBrowseQuery(req.query);
      if (!parsed.ok) return res.status(400).json(parsed.body);

      // userNickname 비어있지 않은 row 만 가져와서 그룹 집계.
      // 전체 row 수 = 부원 수 × 평균 책 권 수 (수천 건 이내 가정).
      // 행수 폭증 시 SQL group-by + having 으로 옮길 후속 PR (#561 코멘트).
      const rows = await prisma.bookShelf.findMany({
        where: { userNickname: { not: null } },
        select: { userId: true, userNickname: true, addedAt: true },
      });
      const aggregated = aggregateByUser(rows);
      const sorted = sortUsers(aggregated, parsed.sort);
      const paged = sorted.slice(parsed.skip, parsed.skip + parsed.pageSize);

      return res.status(200).json({
        users: paged.map(publicBrowseUser),
        pagination: {
          page: parsed.page,
          pageSize: parsed.pageSize,
          total: sorted.length,
          sort: parsed.sort,
        },
      });
    } catch (err) {
      return next(err);
    }
  });

  // GET /u/:userId — 다른 유저 서재 공개 조회 (#292)
  // - 공개·읽기 전용. 별점/리뷰/상태 모두 노출 (현 단계 정책: 모두 공개).
  // - requireAuth 적용 전에 등록 → 비로그인 게스트도 조회 가능.
  // - 페이지네이션 + 정렬은 /me 와 동일한 컨벤션.
  // - userId 검증은 cuid 같은 url-safe 문자만 허용 (path traversal 방지).
  router.get('/u/:userId', async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (typeof userId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(userId)) {
        return res.status(400).json({ error: 'ValidationError', message: 'invalid userId' });
      }
      const parsed = parseListQuery(req.query);
      if (!parsed.ok) return res.status(400).json(parsed.body);

      const all = await prisma.bookShelf.findMany({
        where: { userId },
        include: { book: true },
      });
      const sorted = [...all].sort(compareBy(parsed.sort));
      const paged = sorted.slice(parsed.skip, parsed.skip + parsed.pageSize);
      return res.status(200).json({
        userId,
        shelves: paged.map(publicReadOnlyShelf),
        pagination: {
          page: parsed.page,
          pageSize: parsed.pageSize,
          total: all.length,
          sort: parsed.sort,
        },
      });
    } catch (err) {
      return next(err);
    }
  });

  router.use(auth);

  // GET /me — 내 서재 (page-based pagination: ?page=1&pageSize=20, 최대 100, sort=<key>)
  router.get('/me', async (req, res, next) => {
    try {
      const parsed = parseListQuery(req.query);
      if (!parsed.ok) return res.status(400).json(parsed.body);
      // 전체 row 를 가져와서 정렬한 뒤 페이지를 자른다. Prisma orderBy 만으론
      // nullsLast / book.title 정렬을 일관되게 표현하기 어렵고, 페이지를 먼저 자르면
      // 전역 정렬이 깨진다. 서재 행수는 사용자당 수백 건 이내 가정 (heavy-user 는
      // 별도 pageSize 상한 + lightweight bookIds 엔드포인트로 대응).
      const all = await prisma.bookShelf.findMany({
        where: { userId: req.user.sub },
        include: { book: true },
      });
      const sorted = [...all].sort(compareBy(parsed.sort));
      const paged = sorted.slice(parsed.skip, parsed.skip + parsed.pageSize);
      return res.status(200).json({
        shelves: paged.map(publicShelf),
        pagination: {
          page: parsed.page,
          pageSize: parsed.pageSize,
          total: all.length,
          sort: parsed.sort,
        },
      });
    } catch (err) {
      return next(err);
    }
  });

  // GET /me/contains — lightweight ownership lookup (#477).
  // 100건 myShelves 페이지 대신 O(1)/배치 호출.
  // 핸들러 본문은 shelves.helpers.js#handleContainsLookup.
  router.get('/me/contains', async (req, res, next) => {
    try {
      const result = await handleContainsLookup(req.user.sub, req.query);
      return res.status(result.status).json(result.body);
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
            // #561 — JWT nickname/name 스냅샷. browse 디렉토리 진입 자격.
            userNickname: snapshotNickname(req.user),
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

      // #561 — userNickname null/빈 row 면 PATCH 기회에 JWT 값으로 backfill.
      // 이미 있으면 덮어쓰지 X (사용자가 닉 바꿨을 때 자동 동기화는 별도 PR).
      const existingNickname =
        typeof existing.userNickname === 'string' ? existing.userNickname.trim() : '';
      const backfillNickname =
        existingNickname.length === 0 ? snapshotNickname(req.user) : undefined;

      const updated = await prisma.bookShelf.update({
        where: { userId_bookId: { userId, bookId } },
        data: {
          ...parsed.data,
          status: nextStatus,
          completedAt,
          ...(backfillNickname ? { userNickname: backfillNickname } : {}),
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
