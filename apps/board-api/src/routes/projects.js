/**
 * Projects 라우터 — CRUD.
 *
 * 모든 엔드포인트 require JWT (requireAuth) + 프로젝트별 endpoint는 멤버십 검증.
 * Project 생성 시 OWNER 멤버십 + Todo/Doing/Done 컬럼을 트랜잭션으로 생성.
 *
 * - GET    /projects        — 본인 멤버인 프로젝트 목록
 * - POST   /projects        — 생성 + OWNER + 기본 3컬럼
 * - GET    /projects/:id    — 멤버만
 * - PATCH  /projects/:id    — 멤버만
 * - DELETE /projects/:id    — OWNER만
 */
import { ProjectCreateInput, ProjectUpdateInput } from '@getit/schemas/board';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { requireProjectMember } from '../middleware/requireProjectMember.js';

/** 기본 컬럼 정의 — between-keys 알고리즘 위해 order 간격 1000. */
const DEFAULT_COLUMNS = [
  { name: 'Todo', order: 1000 },
  { name: 'Doing', order: 2000 },
  { name: 'Done', order: 3000 },
];

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
 * 응답에 노출할 안전한 Project 필드만 추림.
 *
 * @param {{ id: string, ownerId: string, name: string, description: string | null, createdAt: Date, updatedAt: Date }} p
 * @returns {{ id: string, ownerId: string, name: string, description: string | null, createdAt: Date, updatedAt: Date }}
 */
const publicProject = (p) => ({
  id: p.id,
  ownerId: p.ownerId,
  name: p.name,
  description: p.description ?? null,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

/**
 * Projects 라우터 생성.
 *
 * @returns {import('express').Router}
 */
export const createProjectsRouter = () => {
  const router = Router();

  // GET /projects — 본인 멤버인 프로젝트만 (DB 레벨 필터링 — 전체 스캔 방지)
  router.get('/', async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const rows = await prisma.project.findMany({
        where: { members: { some: { userId } } },
        orderBy: { createdAt: 'desc' },
      });
      const projects = rows.map(publicProject);
      return res.status(200).json({ projects });
    } catch (err) {
      return next(err);
    }
  });

  // POST /projects — 생성 + OWNER + 기본 컬럼 3개 (트랜잭션)
  router.post('/', async (req, res, next) => {
    try {
      const parsed = ProjectCreateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const userId = req.user.sub;
      const { name, description } = parsed.data;

      const project = await prisma.$transaction(async (tx) => {
        const created = await tx.project.create({
          data: { ownerId: userId, name, description: description ?? null },
        });
        await tx.projectMember.create({
          data: { projectId: created.id, userId, role: 'OWNER' },
        });
        await tx.boardColumn.createMany({
          data: DEFAULT_COLUMNS.map((c) => ({ ...c, projectId: created.id })),
        });
        return created;
      });

      return res.status(201).json({ project: publicProject(project) });
    } catch (err) {
      return next(err);
    }
  });

  // GET /projects/:id — 멤버만
  router.get('/:id', requireProjectMember(), (req, res) => {
    return res.status(200).json({ project: publicProject(req.project) });
  });

  // PATCH /projects/:id — 멤버 누구나 수정 가능 (board spec — MVP)
  router.patch('/:id', requireProjectMember(), async (req, res, next) => {
    try {
      const parsed = ProjectUpdateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      // Zod optional() 미입력 필드는 undefined — Prisma update에서 무시되므로 그대로 전달
      const updated = await prisma.project.update({
        where: { id: req.params.id },
        data: parsed.data,
      });
      return res.status(200).json({ project: publicProject(updated) });
    } catch (err) {
      return next(err);
    }
  });

  // DELETE /projects/:id — OWNER만
  router.delete('/:id', requireProjectMember(), async (req, res, next) => {
    try {
      if (req.projectMember.role !== 'OWNER') {
        return res.status(403).json({ error: 'OwnerOnly' });
      }
      await prisma.project.delete({ where: { id: req.params.id } });
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
