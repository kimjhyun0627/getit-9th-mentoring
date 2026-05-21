/**
 * Cards 라우터 헬퍼 (#48 + #253 + #455).
 *
 * 라우터 핸들러를 얇게 유지하기 위해 권한 lookup / 응답 변환 / PATCH 본문 검증을 분리.
 * cards.js 가 300 LoC 제한을 넘지 않도록 추출 — 운영 동작은 동일.
 */
import { prisma } from '../lib/prisma.js';

/** 자동 order 배치 간격 (between-keys). */
export const ORDER_GAP = 1000;

/**
 * Zod 에러를 400 응답 본문으로 변환.
 *
 * @param {import('zod').ZodError} err
 */
export const zodErrorBody = (err) => ({
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
export const publicCard = (c) => ({
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
 *
 * @param {string | undefined} columnId
 * @param {string} userId
 */
export const lookupColumnAccess = async (columnId, userId) => {
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
export const lookupCardAccess = async (cardId, userId) => {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return { ok: false, status: 404, body: { error: 'CardNotFound' } };
  const column = await prisma.boardColumn.findUnique({ where: { id: card.columnId } });
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
export const isValidAssignee = async (assigneeId, projectId) => {
  if (assigneeId === null || assigneeId === undefined) return true;
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: assigneeId },
  });
  return !!member;
};

/**
 * PATCH 본문 검증 + expectedUpdatedAt + assignee 검증 후 updateMany 실행.
 * 라우터 핸들러를 얇게 유지하기 위한 헬퍼 (#455).
 *
 * @param {string} cardId
 * @param {{ expectedUpdatedAt?: string } & Record<string, unknown>} parsedData
 * @param {{ card: any; projectId: string }} access
 * @returns {Promise<{ status: number; body: object }>}
 */
export const applyCardPatch = async (cardId, parsedData, access) => {
  const { expectedUpdatedAt, ...data } = parsedData;
  if (!expectedUpdatedAt) {
    return {
      status: 400,
      body: {
        error: 'MissingExpectedUpdatedAt',
        message: 'expectedUpdatedAt is required (last-write-wins guard).',
        card: publicCard(access.card),
      },
    };
  }
  if ('assigneeId' in data && !(await isValidAssignee(data.assigneeId, access.projectId))) {
    return { status: 422, body: { error: 'AssigneeNotMember' } };
  }
  const result = await prisma.card.updateMany({
    where: { id: cardId, updatedAt: new Date(expectedUpdatedAt) },
    data,
  });
  if (result.count === 0) {
    const latest = await prisma.card.findUnique({ where: { id: cardId } });
    if (!latest) return { status: 404, body: { error: 'CardNotFound' } };
    return { status: 409, body: { error: 'Conflict', card: publicCard(latest) } };
  }
  const saved = await prisma.card.findUnique({ where: { id: cardId } });
  return { status: 200, body: { card: publicCard(saved) } };
};
