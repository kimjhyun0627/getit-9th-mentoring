/**
 * 프로젝트 멤버십 검증 미들웨어.
 *
 * URL의 `:projectId` 또는 `:id` 파라미터에 해당하는 프로젝트의 ProjectMember 로우가
 * 현재 로그인 사용자(`req.user.sub`)에게 존재하는지 확인한다.
 *
 * - 미존재 프로젝트 → 404
 * - 멤버 아님 → 403
 * - 통과 시 `req.projectMember` 에 멤버 row를 박아 다음 핸들러에서 role 검사 가능.
 *
 * 사용 예:
 *   router.get('/:id', requireAuth(...), requireProjectMember(), handler)
 */
import { prisma } from '../lib/prisma.js';

/**
 * @param {{ paramName?: string }} [opts]
 * @returns {import('express').RequestHandler}
 */
export const requireProjectMember = (opts = {}) => {
  const paramName = opts.paramName ?? 'id';

  return async (req, res, next) => {
    try {
      const projectId = req.params[paramName];
      if (!projectId) {
        return res.status(400).json({ error: 'MissingProjectId' });
      }

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        return res.status(404).json({ error: 'ProjectNotFound' });
      }

      const userId = req.user?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const member = await prisma.projectMember.findFirst({
        where: { projectId, userId },
      });
      if (!member) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.project = project;
      req.projectMember = member;
      return next();
    } catch (err) {
      return next(err);
    }
  };
};
