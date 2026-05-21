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
import { zodErrorBody } from '@getit/schemas/errors';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { lookupUserNames } from '../lib/userLookup.js';
import { requireProjectMember } from '../middleware/requireProjectMember.js';

/** 기본 컬럼 정의 — between-keys 알고리즘 위해 order 간격 1000. */
const DEFAULT_COLUMNS = [
  { name: 'Todo', order: 1000 },
  { name: 'Doing', order: 2000 },
  { name: 'Done', order: 3000 },
];

/**
 * 응답에 노출할 안전한 Project 필드만 추림.
 *
 * @param {{ id: string, ownerId: string, name: string, description: string | null, createdAt: Date, updatedAt: Date }} p
 * @param {{
 *   role?: 'OWNER' | 'MEMBER' | null,
 *   members?: Array<{ userId: string, role: 'OWNER'|'MEMBER', name: string | null }>,
 *   currentUserId?: string | null,
 * }} [extra]
 */
const publicProject = (p, extra = {}) => ({
  id: p.id,
  ownerId: p.ownerId,
  name: p.name,
  description: p.description ?? null,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
  role: extra.role ?? null,
  members: extra.members ?? [],
  currentUserId: extra.currentUserId ?? null,
});

/**
 * 주어진 프로젝트들에 대해 (현재 user role, 전체 멤버 목록) 을 한 번에 조회한다.
 * `auth.User` cross-schema lookup 으로 name 을 채운다 (#398). 실패 시 null.
 *
 * 단계:
 *   1. 한 쿼리로 해당 프로젝트들의 모든 ProjectMember 조회 (N+1 회피)
 *   2. 모든 userId 모아 auth.User 한 번에 lookup
 *   3. projectId 별로 그룹핑 + 현재 user role 추출
 *
 * @param {Array<{ id: string }>} projects
 * @param {string} userId
 * @returns {Promise<Map<string, { role: 'OWNER'|'MEMBER'|null, members: Array<{ userId: string, role: 'OWNER'|'MEMBER', name: string|null }> }>>}
 */
const fetchRoleAndMembers = async (projects, userId) => {
  /** @type {Map<string, { role: 'OWNER'|'MEMBER'|null, members: Array<{ userId: string, role: 'OWNER'|'MEMBER', name: string|null }> }>} */
  const out = new Map();
  if (projects.length === 0) return out;
  const ids = projects.map((p) => p.id);
  const memberships = await prisma.projectMember.findMany({
    where: { projectId: { in: ids } },
    orderBy: { userId: 'asc' },
  });
  const nameByUserId = await lookupUserNames(memberships.map((m) => m.userId));
  for (const id of ids) out.set(id, { role: null, members: [] });
  for (const m of memberships) {
    const bucket = out.get(m.projectId);
    if (!bucket) continue;
    bucket.members.push({
      userId: m.userId,
      role: m.role,
      name: nameByUserId.get(m.userId) ?? null,
    });
    if (m.userId === userId) bucket.role = m.role;
  }
  return out;
};

/**
 * Projects 라우터 생성.
 *
 * @returns {import('express').Router}
 */
export const createProjectsRouter = () => {
  const router = Router();

  // GET /projects — 본인 멤버인 프로젝트만 (DB 레벨 필터링 — 전체 스캔 방지).
  // 응답에 현재 user role + 전체 멤버 목록 + currentUserId (FE 카드 표시용, #297) 포함.
  router.get('/', async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const rows = await prisma.project.findMany({
        where: { members: { some: { userId } } },
        orderBy: { createdAt: 'desc' },
      });
      const meta = await fetchRoleAndMembers(rows, userId);
      const projects = rows.map((p) =>
        publicProject(p, { ...meta.get(p.id), currentUserId: userId }),
      );
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

      const meta = await fetchRoleAndMembers([project], userId);
      return res.status(201).json({
        project: publicProject(project, { ...meta.get(project.id), currentUserId: userId }),
      });
    } catch (err) {
      return next(err);
    }
  });

  // GET /projects/:id — 멤버만. role + 멤버 목록 + currentUserId 동봉 (#297).
  router.get('/:id', requireProjectMember(), async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const meta = await fetchRoleAndMembers([req.project], userId);
      return res.status(200).json({
        project: publicProject(req.project, { ...meta.get(req.project.id), currentUserId: userId }),
      });
    } catch (err) {
      return next(err);
    }
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
      const userId = req.user.sub;
      const meta = await fetchRoleAndMembers([updated], userId);
      return res.status(200).json({
        project: publicProject(updated, { ...meta.get(updated.id), currentUserId: userId }),
      });
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
