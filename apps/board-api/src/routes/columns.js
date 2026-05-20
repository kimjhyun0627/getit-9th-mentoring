/**
 * BoardColumns 라우터 — 프로젝트 내 컬럼 CRUD.
 *
 * 모든 엔드포인트는 부모 미들웨어로 requireAuth + requireProjectMember 통과 후 진입.
 * mergeParams: true 로 부모 라우터의 `:id` (projectId) 를 사용한다.
 *
 * - GET    /                — 프로젝트 컬럼 목록 (order asc)
 * - POST   /                — 컬럼 생성 (order 미지정 시 마지막 컬럼 뒤 +1000)
 * - PATCH  /:colId          — name / order 수정
 * - DELETE /:colId          — 삭제 (마지막 1개는 409 가드)
 *
 * 권한 모델: 멤버 누구나 컬럼 CRUD 가능 (board MVP — OWNER 전용 게이트 없음).
 * 다른 프로젝트의 컬럼 ID 가 들어오면 404 (스코프 leak 방지).
 */
import { BoardColumnCreateInput, BoardColumnUpdateInput } from '@getit/schemas/board';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

/** 신규 컬럼 자동 배치 시 마지막 order 에 더할 간격 (between-keys). */
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
 * 응답에 노출할 안전한 컬럼 필드.
 *
 * @param {{ id: string, projectId: string, name: string, order: number }} c
 */
const publicColumn = (c) => ({
  id: c.id,
  projectId: c.projectId,
  name: c.name,
  order: c.order,
});

/**
 * BoardColumns 라우터 생성.
 *
 * @returns {import('express').Router}
 */
export const createColumnsRouter = () => {
  const router = Router({ mergeParams: true });

  // GET / — 컬럼 목록 (order asc, id tiebreak)
  router.get('/', async (req, res, next) => {
    try {
      const projectId = req.params.id;
      const rows = await prisma.boardColumn.findMany({
        where: { projectId },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      });
      return res.status(200).json({ columns: rows.map(publicColumn) });
    } catch (err) {
      return next(err);
    }
  });

  // POST / — 컬럼 생성. order 자동 배치 시 last-lookup + create 를
  // $transaction 으로 묶어 동시 생성 race 에서 결정적 순서를 보장한다.
  router.post('/', async (req, res, next) => {
    try {
      const parsed = BoardColumnCreateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const projectId = req.params.id;
      const { name } = parsed.data;
      const explicitOrder = parsed.data.order;

      const created = await prisma.$transaction(async (tx) => {
        let order = explicitOrder;
        if (order === undefined) {
          const last = await tx.boardColumn.findFirst({
            where: { projectId },
            orderBy: [{ order: 'desc' }, { id: 'desc' }],
          });
          order = (last?.order ?? 0) + ORDER_GAP;
        }
        return tx.boardColumn.create({ data: { projectId, name, order } });
      });
      return res.status(201).json({ column: publicColumn(created) });
    } catch (err) {
      return next(err);
    }
  });

  // PATCH /:colId — 같은 프로젝트 소속이어야 함
  router.patch('/:colId', async (req, res, next) => {
    try {
      const parsed = BoardColumnUpdateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const projectId = req.params.id;
      const colId = req.params.colId;

      const existing = await prisma.boardColumn.findUnique({ where: { id: colId } });
      if (!existing || existing.projectId !== projectId) {
        return res.status(404).json({ error: 'ColumnNotFound' });
      }

      const updated = await prisma.boardColumn.update({
        where: { id: colId },
        data: parsed.data,
      });
      return res.status(200).json({ column: publicColumn(updated) });
    } catch (err) {
      return next(err);
    }
  });

  // DELETE /:colId — 마지막 컬럼 가드. count + delete 를 $transaction 으로 묶어
  // 동시 삭제로 컬럼 0개가 되는 race 를 막는다. (DB 격리/잠금이 최종 보증)
  router.delete('/:colId', async (req, res, next) => {
    try {
      const projectId = req.params.id;
      const colId = req.params.colId;

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.boardColumn.findUnique({ where: { id: colId } });
        if (!existing || existing.projectId !== projectId) {
          return { status: 404, body: { error: 'ColumnNotFound' } };
        }
        const total = await tx.boardColumn.count({ where: { projectId } });
        if (total <= 1) {
          return { status: 409, body: { error: 'LastColumn' } };
        }
        await tx.boardColumn.delete({ where: { id: colId } });
        return { status: 204 };
      });

      if (result.status === 204) return res.status(204).send();
      return res.status(result.status).json(result.body);
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
