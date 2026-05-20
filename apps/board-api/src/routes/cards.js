/**
 * Cards 라우터 — 카드 CRUD + between-keys 이동.
 *
 * 마운트: `/api/cards` (프로젝트 경로 아래가 아니라 평탄한 경로).
 * 권한 모델: 카드(또는 컬럼) → BoardColumn → Project → ProjectMember 검증.
 *  - URL 에 projectId 가 없으므로 미들웨어 대신 핸들러 안에서 lookup 한다.
 *  - 비멤버 → 403 / 카드(컬럼) 부재 → 404.
 *
 * 엔드포인트:
 *  - GET    /api/cards?columnId=...      — 컬럼별 카드 목록 (order asc)
 *  - GET    /api/cards/:id               — 단건 조회
 *  - POST   /api/cards                   — 생성 (body: columnId, title, description?, assigneeId?, order?)
 *  - PATCH  /api/cards/:id               — title/description/assigneeId 수정
 *  - DELETE /api/cards/:id
 *  - PATCH  /api/cards/:id/move          — { columnId, order } between-keys 이동
 *
 * order 자동 배치: 미입력 시 같은 컬럼의 마지막 order + 1000 (between-keys 알고리즘).
 * assignee 검증: assigneeId 값이 들어오면 해당 프로젝트 멤버여야 함 (아니면 422).
 */
import { CardCreateInput, CardMoveInput, CardUpdateInput } from '@getit/schemas/board';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

/** 자동 order 배치 간격 (between-keys). */
const ORDER_GAP = 1000;

/**
 * Zod 에러를 400 응답 본문으로 변환.
 *
 * @param {import('zod').ZodError} err
 */
const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

/**
 * 응답에 노출할 안전한 Card 필드.
 *
 * @param {{
 *   id: string,
 *   columnId: string,
 *   title: string,
 *   description: string | null,
 *   assigneeId: string | null,
 *   order: number,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} c
 */
const publicCard = (c) => ({
  id: c.id,
  columnId: c.columnId,
  title: c.title,
  description: c.description ?? null,
  assigneeId: c.assigneeId ?? null,
  order: c.order,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

/**
 * 컬럼 ID 로 컬럼 + 소속 프로젝트 + 멤버십을 lookup. 권한/존재 가드를 일괄 처리한다.
 * 반환은 ok flag 가 있는 discriminated union — ok=true 면 column/projectId, false 면 status/body.
 *
 * @param {string | undefined} columnId
 * @param {string} userId
 */
const lookupColumnAccess = async (columnId, userId) => {
  if (!columnId) return { ok: false, status: 400, body: { error: 'MissingColumnId' } };
  const column = await prisma.boardColumn.findUnique({ where: { id: columnId } });
  if (!column) return { ok: false, status: 404, body: { error: 'ColumnNotFound' } };
  const member = await prisma.projectMember.findFirst({
    where: { projectId: column.projectId, userId },
  });
  if (!member) return { ok: false, status: 403, body: { error: 'Forbidden' } };
  return { ok: true, column, projectId: column.projectId };
};

/**
 * 카드 ID 로 카드 + 소속 컬럼 + 멤버십을 lookup.
 *
 * @param {string} cardId
 * @param {string} userId
 */
const lookupCardAccess = async (cardId, userId) => {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return { ok: false, status: 404, body: { error: 'CardNotFound' } };
  const column = await prisma.boardColumn.findUnique({ where: { id: card.columnId } });
  // 컬럼이 사라진 카드는 cascade 로 같이 사라져야 정상 — 방어적으로 404 처리.
  if (!column) return { ok: false, status: 404, body: { error: 'CardNotFound' } };
  const member = await prisma.projectMember.findFirst({
    where: { projectId: column.projectId, userId },
  });
  if (!member) return { ok: false, status: 403, body: { error: 'Forbidden' } };
  return { ok: true, card, column, projectId: column.projectId };
};

/**
 * assigneeId 값이 해당 프로젝트의 멤버인지 검증. null/undefined 는 검증 통과.
 *
 * @param {string | null | undefined} assigneeId
 * @param {string} projectId
 * @returns {Promise<boolean>}
 */
const isValidAssignee = async (assigneeId, projectId) => {
  if (assigneeId === null || assigneeId === undefined) return true;
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: assigneeId },
  });
  return !!member;
};

/**
 * Cards 라우터 생성.
 *
 * @returns {import('express').Router}
 */
export const createCardsRouter = () => {
  const router = Router();

  // GET /api/cards?columnId=xxx — 컬럼별 카드 목록 (단일 컬럼).
  // GET /api/cards?projectId=xxx — 프로젝트 전체 카드 batch (#258).
  //   N+1 회피: 프로젝트 단위 batch는 prisma 한 번에 모든 컬럼의 카드를 조회한다.
  //   응답: { cardsByColumn: Record<columnId, Card[]> } — FE useQuery 단일 키.
  router.get('/', async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
      if (projectId) {
        const member = await prisma.projectMember.findFirst({ where: { projectId, userId } });
        if (!member) return res.status(403).json({ error: 'Forbidden' });
        const columns = await prisma.boardColumn.findMany({
          where: { projectId },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        });
        const columnIds = columns.map((c) => c.id);
        const rows =
          columnIds.length === 0
            ? []
            : await prisma.card.findMany({
                where: { columnId: { in: columnIds } },
                orderBy: [{ order: 'asc' }, { id: 'asc' }],
              });
        /** @type {Record<string, ReturnType<typeof publicCard>[]>} */
        const cardsByColumn = {};
        for (const id of columnIds) cardsByColumn[id] = [];
        for (const c of rows) cardsByColumn[c.columnId]?.push(publicCard(c));
        return res.status(200).json({ cardsByColumn });
      }

      const columnId = typeof req.query.columnId === 'string' ? req.query.columnId : undefined;
      const access = await lookupColumnAccess(columnId, userId);
      if (!access.ok) return res.status(access.status).json(access.body);

      const rows = await prisma.card.findMany({
        where: { columnId: access.column.id },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      });
      return res.status(200).json({ cards: rows.map(publicCard) });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/cards/:id — 단건 조회
  router.get('/:id', async (req, res, next) => {
    try {
      const access = await lookupCardAccess(req.params.id, req.user.sub);
      if (!access.ok) return res.status(access.status).json(access.body);
      return res.status(200).json({ card: publicCard(access.card) });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/cards — 생성. order 자동 배치 + assignee 검증을 transaction 으로 묶어
  // 동시 생성 race 에서 결정적 순서를 보장한다.
  // columnId 는 CardCreateInput Zod 스키마가 검증한다 (라우터 안에서 별도 검증 X).
  router.post('/', async (req, res, next) => {
    try {
      const result = CardCreateInput.safeParse(req.body);
      if (!result.success) return res.status(400).json(zodErrorBody(result.error));

      const { columnId, title, description, assigneeId, order: explicitOrder } = result.data;

      const access = await lookupColumnAccess(columnId, req.user.sub);
      if (!access.ok) return res.status(access.status).json(access.body);

      if (!(await isValidAssignee(assigneeId, access.projectId))) {
        return res.status(422).json({ error: 'AssigneeNotMember' });
      }

      const created = await prisma.$transaction(async (tx) => {
        let order = explicitOrder;
        if (order === undefined) {
          const last = await tx.card.findFirst({
            where: { columnId: access.column.id },
            orderBy: [{ order: 'desc' }, { id: 'desc' }],
          });
          order = (last?.order ?? 0) + ORDER_GAP;
        }
        return tx.card.create({
          data: {
            columnId: access.column.id,
            title,
            description: description ?? null,
            assigneeId: assigneeId ?? null,
            order,
          },
        });
      });
      return res.status(201).json({ card: publicCard(created) });
    } catch (err) {
      return next(err);
    }
  });

  // PATCH /api/cards/:id — title/description/assigneeId 수정 (order 변경은 /move 전담)
  router.patch('/:id', async (req, res, next) => {
    try {
      const parsed = CardUpdateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const access = await lookupCardAccess(req.params.id, req.user.sub);
      if (!access.ok) return res.status(access.status).json(access.body);

      if ('assigneeId' in parsed.data) {
        if (!(await isValidAssignee(parsed.data.assigneeId, access.projectId))) {
          return res.status(422).json({ error: 'AssigneeNotMember' });
        }
      }

      const updated = await prisma.card.update({
        where: { id: req.params.id },
        data: parsed.data,
      });
      return res.status(200).json({ card: publicCard(updated) });
    } catch (err) {
      return next(err);
    }
  });

  // DELETE /api/cards/:id
  router.delete('/:id', async (req, res, next) => {
    try {
      const access = await lookupCardAccess(req.params.id, req.user.sub);
      if (!access.ok) return res.status(access.status).json(access.body);
      await prisma.card.delete({ where: { id: req.params.id } });
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  });

  // PATCH /api/cards/:id/move — 컬럼 이동 (같은 프로젝트 안에서만).
  // order 미입력 시 대상 컬럼 끝(lastOrder + 1000). 같은 컬럼 내 재정렬도 동일 경로로 처리.
  // 다른 카드 row 는 건드리지 않는다 (between-keys 의 핵심).
  router.patch('/:id/move', async (req, res, next) => {
    try {
      const parsed = CardMoveInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const access = await lookupCardAccess(req.params.id, req.user.sub);
      if (!access.ok) return res.status(access.status).json(access.body);

      const { columnId: targetColumnId, order: explicitOrder } = parsed.data;

      // 다른 프로젝트의 컬럼으로 이동 금지 — 같은 프로젝트면 OK, 아니면 404.
      const targetColumn = await prisma.boardColumn.findUnique({ where: { id: targetColumnId } });
      if (!targetColumn || targetColumn.projectId !== access.projectId) {
        return res.status(404).json({ error: 'ColumnNotFound' });
      }

      const updated = await prisma.$transaction(async (tx) => {
        let order = explicitOrder;
        if (order === undefined) {
          const last = await tx.card.findFirst({
            where: { columnId: targetColumn.id },
            orderBy: [{ order: 'desc' }, { id: 'desc' }],
          });
          // 자기 자신이 이미 같은 컬럼 끝이면 order 유지 (no-op move) — 그 외엔 +1000.
          // last 가 자기 자신인 경우 +1000 하면 같은 카드 no-op 호출만으로 order 가 계속 커진다.
          if (last && last.id === access.card.id) {
            order = last.order;
          } else {
            order = (last?.order ?? 0) + ORDER_GAP;
          }
        }
        return tx.card.update({
          where: { id: access.card.id },
          data: { columnId: targetColumn.id, order },
        });
      });
      return res.status(200).json({ card: publicCard(updated) });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
