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
 *  - GET    /api/cards?projectId=...     — 프로젝트 전체 카드 batch (#258)
 *  - GET    /api/cards/:id               — 단건 조회
 *  - POST   /api/cards                   — 생성
 *  - PATCH  /api/cards/:id               — title/description/assigneeId 수정 (#253 + #455 expectedUpdatedAt 필수)
 *  - DELETE /api/cards/:id
 *  - PATCH  /api/cards/:id/move          — { columnId, order } between-keys 이동
 *
 * 권한 lookup / PATCH apply / publicCard 변환 등 헬퍼는 cardsHelpers.js 로 분리해
 * 이 파일은 300 LoC 제한 안에서 라우팅에만 집중.
 */
import { CardCreateInput, CardMoveInput, CardUpdateInput } from '@getit/schemas/board';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

import {
  applyCardPatch,
  isValidAssignee,
  lookupCardAccess,
  lookupColumnAccess,
  ORDER_GAP,
  publicCard,
  zodErrorBody,
} from './cardsHelpers.js';

/**
 * Cards 라우터 생성.
 *
 * @returns {import('express').Router}
 */
export const createCardsRouter = () => {
  const router = Router();

  // GET /api/cards — columnId 또는 projectId 쿼리. projectId 면 N+1 회피 batch.
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

  // PATCH /api/cards/:id — title/description/assigneeId 수정 (order 는 /move 전담).
  // #253 + #455: expectedUpdatedAt 필수. 자세한 로직은 applyCardPatch.
  router.patch('/:id', async (req, res, next) => {
    try {
      const parsed = CardUpdateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const access = await lookupCardAccess(req.params.id, req.user.sub);
      if (!access.ok) return res.status(access.status).json(access.body);
      const { status, body } = await applyCardPatch(req.params.id, parsed.data, access);
      return res.status(status).json(body);
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
  // order 미입력 시 대상 컬럼 끝(lastOrder + 1000). 같은 컬럼 내 재정렬도 동일 경로.
  // 다른 카드 row 는 건드리지 않는다 (between-keys 의 핵심).
  router.patch('/:id/move', async (req, res, next) => {
    try {
      const parsed = CardMoveInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const access = await lookupCardAccess(req.params.id, req.user.sub);
      if (!access.ok) return res.status(access.status).json(access.body);

      const { columnId: targetColumnId, order: explicitOrder } = parsed.data;

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
          // 자기 자신이 이미 같은 컬럼 끝이면 order 유지 (no-op move).
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
