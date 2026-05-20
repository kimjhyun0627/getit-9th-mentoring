/**
 * Project Members 라우터 — 초대 / 추방 / 탈퇴.
 *
 * - POST   /projects/:id/members              — OWNER만 새 멤버 초대
 * - DELETE /projects/:id/members/:userId      — 본인 탈퇴(MEMBER) or OWNER가 추방
 *
 * OWNER 본인 탈퇴는 400 — 별도의 소유권 이전 엔드포인트(미구현)로 처리해야 한다.
 *
 * 마운트:
 *   `app.use('/api/projects/:id/members', requireAuth, requireProjectMember, createMembersRouter())`
 *   mergeParams: true 로 부모 `:id` 를 자식 라우터에서 사용.
 */
import { ProjectMemberInput } from '@getit/schemas/board';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

// Prisma unique constraint violation code (projectId+userId 충돌 시).
const PRISMA_UNIQUE_VIOLATION = 'P2002';

const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

const publicMember = (m) => ({
  id: m.id,
  projectId: m.projectId,
  userId: m.userId,
  role: m.role,
  joinedAt: m.joinedAt,
});

/**
 * Members 라우터 생성. mergeParams 로 부모 `:id` 사용.
 *
 * @returns {import('express').Router}
 */
export const createMembersRouter = () => {
  const router = Router({ mergeParams: true });

  // GET /projects/:id/members — 멤버 누구나 (담당자 picker 용, #200).
  // SSO User 테이블이 다른 DB에 있어 name 은 일단 null. 추후 user lookup 연동 지점.
  router.get('/', async (req, res, next) => {
    try {
      const projectId = req.params.id;
      const rows = await prisma.projectMember.findMany({
        where: { projectId },
        orderBy: { userId: 'asc' },
      });
      const members = rows.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        name: null,
      }));
      return res.status(200).json({ members });
    } catch (err) {
      return next(err);
    }
  });

  // POST /projects/:id/members — OWNER만
  router.post('/', async (req, res, next) => {
    try {
      if (req.projectMember.role !== 'OWNER') {
        return res.status(403).json({ error: 'OwnerOnly' });
      }
      const parsed = ProjectMemberInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const projectId = req.params.id;
      const { userId, role } = parsed.data;

      try {
        const member = await prisma.projectMember.create({
          data: { projectId, userId, role: role ?? 'MEMBER' },
        });
        return res.status(201).json({ member: publicMember(member) });
      } catch (err) {
        if (err?.code === PRISMA_UNIQUE_VIOLATION) {
          return res.status(409).json({ error: 'AlreadyMember' });
        }
        throw err;
      }
    } catch (err) {
      return next(err);
    }
  });

  // DELETE /projects/:id/members/:userId
  router.delete('/:userId', async (req, res, next) => {
    try {
      const projectId = req.params.id;
      const targetUserId = req.params.userId;
      const me = req.user.sub;
      const myRole = req.projectMember.role;

      // OWNER는 본인 탈퇴 불가 — 소유권 이전 먼저
      if (targetUserId === me && myRole === 'OWNER') {
        return res.status(400).json({ error: 'OwnerCannotLeave' });
      }

      // 본인 탈퇴는 누구나 / 다른 사람 추방은 OWNER만
      if (targetUserId !== me && myRole !== 'OWNER') {
        return res.status(403).json({ error: 'OwnerOnly' });
      }

      // deleteMany 한 번으로 조회 + 삭제를 동시에 처리 (count로 존재 여부 확인)
      const result = await prisma.projectMember.deleteMany({
        where: { projectId, userId: targetUserId },
      });
      if (result.count === 0) {
        return res.status(404).json({ error: 'MemberNotFound' });
      }
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
