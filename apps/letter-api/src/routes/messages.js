/**
 * letter-api 메시지 라우터 — 익명 롤링페이퍼 CRUD.
 *
 * 엔드포인트:
 *  - POST   /api/messages       — 작성 (JWT 필요)
 *  - GET    /api/messages       — 목록 + is_mine 플래그 (JWT 필요)
 *  - PATCH  /api/messages/:id   — 본인만 (JWT 필요)
 *  - DELETE /api/messages/:id   — 본인만 (JWT 필요)
 *
 * 익명성 (Spec 핵심 — `.claude/projects/letter.md`):
 *  - 모든 응답에서 authorId / author 키 절대 노출 X.
 *  - 본인 식별은 응답의 is_mine boolean 만.
 *  - DB authorId 는 본인 검증 (JWT sub 와 매칭) 에만 사용.
 *
 * 권한 검증 (TOCTOU 회피):
 *  - DELETE / PATCH 는 `deleteMany` / `updateMany` 로 (id, authorId) 동시 조건.
 *    count === 1 이면 success, count === 0 이면 findUnique 로 404/403 분기.
 *
 * 응답 모양 회귀 (snapshot/contract) 는 #53 (BE-security) 에서 별도.
 */
import { requireAuth } from '@getit/auth-utils/server';
import { zodErrorBody } from '@getit/schemas/errors';
import { MessageCreateInput, MessageIdParam, MessageUpdateInput } from '@getit/schemas/letter';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

/**
 * createdAt 을 분(minute) 단위로 라운딩한 ISO 문자열로 변환.
 *
 * 익명성 위협 (#250): ms 정밀도 timestamp 는 timing oracle.
 * 어떤 메시지가 "정확히 14:23:47.328Z 에 작성됐다" 는 시그널이 Slack/Discord
 * 활동 로그와 cross-reference 되면 30~50명 동아리에서 작성자 추측 가능.
 * 분 단위로 자르면 FE 의 `formatRelative` ("방금 전" / "N분 전") 표시는 그대로.
 *
 * @param {Date | string | null | undefined} v
 * @returns {string | null}
 */
const truncateToMinuteISO = (v) => {
  if (v == null) return null;
  const src = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(src.getTime())) return null;
  // ⚠️ src 가 호출자의 row.createdAt 참조일 수 있어 절대 mutate 금지.
  // 새 Date 만들어 초/ms 만 0 처리. UTC 기준이라 tz drift 없음.
  const out = new Date(src.getTime());
  out.setUTCSeconds(0, 0);
  return out.toISOString();
};

/**
 * Message DB row → API 응답 직렬화.
 *
 * 익명성 invariant (Spec 핵심 — `.claude/projects/letter.md`):
 *  - ⚠️ authorId 는 명시적으로 제거. 응답에 절대 포함되면 안 됨.
 *  - ⚠️ updatedAt 미노출 (#251): updatedAt !== createdAt 자체가 "편집됨" 시그널 →
 *    deanonymize 표면. DB 에는 유지 (admin/audit 용도).
 *  - ⚠️ createdAt 분 단위 truncate (#250): ms 정밀도 timing oracle 차단.
 *
 * @param {object} row - prisma Message row
 * @param {string} viewerSub - JWT sub (본인 식별용)
 * @returns {object} 응답에 안전한 객체
 */
const serializeMessage = (row, viewerSub) => {
  const isMine = row.authorId === viewerSub;
  return {
    id: row.id,
    content: row.content,
    color: row.color,
    createdAt: truncateToMinuteISO(row.createdAt),
    is_mine: isMine,
  };
};

/**
 * 메시지 라우터 생성.
 *
 * @param {{
 *   jwtSecret: string,
 *   mutationLimiter: import('express').RequestHandler,
 *   readLimiter?: import('express').RequestHandler,
 * }} opts
 * @returns {import('express').Router}
 */
export const createMessagesRouter = ({ jwtSecret, mutationLimiter, readLimiter }) => {
  const router = Router();
  const auth = requireAuth({ secret: jwtSecret });
  // readLimiter 미제공 시 no-op (테스트/하위호환). 운영은 항상 주입됨.
  const readGuard = readLimiter ?? ((_req, _res, next) => next());

  // POST /api/messages — 작성
  router.post('/messages', auth, mutationLimiter, async (req, res, next) => {
    try {
      const parsed = MessageCreateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const created = await prisma.message.create({
        data: {
          authorId: req.user.sub,
          content: parsed.data.content,
          color: parsed.data.color,
        },
      });

      return res.status(201).json({ message: serializeMessage(created, req.user.sub) });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/messages — 목록 (is_mine 판단 필요해 JWT 필수, #252 polling oracle 차단)
  router.get('/messages', auth, readGuard, async (req, res, next) => {
    try {
      const rows = await prisma.message.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return res.status(200).json({
        items: rows.map((r) => serializeMessage(r, req.user.sub)),
      });
    } catch (err) {
      return next(err);
    }
  });

  // PATCH /api/messages/:id — 본인만
  router.patch('/messages/:id', auth, mutationLimiter, async (req, res, next) => {
    try {
      const parsedParam = MessageIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));
      const parsedBody = MessageUpdateInput.safeParse(req.body);
      if (!parsedBody.success) return res.status(400).json(zodErrorBody(parsedBody.error));

      const id = parsedParam.data.id;
      // TOCTOU 회피: (id, authorId) 동시 조건. 본인만 한 번에 갱신.
      const result = await prisma.message.updateMany({
        where: { id, authorId: req.user.sub },
        data: parsedBody.data,
      });

      if (result.count === 1) {
        const updated = await prisma.message.findUnique({ where: { id } });
        // 동시 race 가드: updateMany 직후 다른 요청이 삭제했을 가능성 → null 가드.
        // serializeMessage(null, ...) 호출 시 500 터지는 걸 회피.
        if (!updated) return res.status(404).json({ error: 'MessageNotFound' });
        return res.status(200).json({ message: serializeMessage(updated, req.user.sub) });
      }

      // count 0 → 미존재 / 타인 소유 구분.
      const exists = await prisma.message.findUnique({
        where: { id },
        select: { authorId: true },
      });
      if (!exists) return res.status(404).json({ error: 'MessageNotFound' });
      return res.status(403).json({ error: 'Forbidden' });
    } catch (err) {
      return next(err);
    }
  });

  // DELETE /api/messages/:id — 본인만
  router.delete('/messages/:id', auth, mutationLimiter, async (req, res, next) => {
    try {
      const parsedParam = MessageIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));

      const id = parsedParam.data.id;
      const result = await prisma.message.deleteMany({
        where: { id, authorId: req.user.sub },
      });
      if (result.count === 1) return res.status(204).send();

      const exists = await prisma.message.findUnique({
        where: { id },
        select: { authorId: true },
      });
      if (!exists) return res.status(404).json({ error: 'MessageNotFound' });
      return res.status(403).json({ error: 'Forbidden' });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
