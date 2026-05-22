/**
 * 내 활동 (me) 도메인 API.
 *
 * GET /api/me/posts          — 내가 만든 모임 (hobby-api)
 * GET /api/me/applications   — 내가 신청한 모임 (hobby-api)
 * GET /api/me                — 현재 사용자 정보 (auth-api, 별도 baseURL)
 */
import { z } from 'zod';

import { authClient, client } from './api.core.js';
import { assertListShape } from './api.helpers.js';

/**
 * auth-api `/me` 응답 shape. id/sub 중 하나는 반드시 비어있지 않은 문자열.
 * email/name 은 optional + null 허용 (BE 가 null 로 내려도 통과).
 * passthrough — 미래 필드 추가 시 forward-compatible.
 *
 * school-auth (#540) — nickname / studentId / schoolEmail / schoolVerifiedAt / createdAt
 * 도 nullish 로 받아 normalize 단계에서 일관된 shape 로 노출.
 * #541: 학교 인증 가드 — `schoolVerifiedAt` 은 ISO datetime 또는 null 허용.
 *   - 키 누락도 허용 (이전 버전 BE 호환).
 */
const meUserSchema = z
  .object({
    id: z.string().min(1).optional(),
    sub: z.string().min(1).optional(),
    email: z.string().nullish(),
    name: z.string().nullish(),
    nickname: z.string().nullish(),
    studentId: z.string().nullish(),
    schoolEmail: z.string().nullish(),
    schoolVerifiedAt: z.string().datetime().nullish(),
    createdAt: z.string().nullish(),
  })
  .passthrough();

const meResponseSchema = z.object({ user: meUserSchema });

/**
 * GET /api/me/posts — 내가 만든 모임. JWT 필요.
 *
 * @param {{ cursor?: string; limit?: number; status?: string }} [params]
 */
export const listMyPosts = async (params = {}) => {
  const res = await client.get('/me/posts', { params });
  assertListShape(res.data);
  return res.data;
};

/**
 * GET /api/me/applications — 내가 신청한 모임. JWT 필요.
 *
 * @param {{ cursor?: string; limit?: number }} [params]
 */
export const listMyApplications = async (params = {}) => {
  const res = await client.get('/me/applications', { params });
  assertListShape(res.data);
  return res.data;
};

/**
 * GET (auth-api) /api/me — 현재 사용자. 비로그인이면 401 reject.
 *
 * auth-api 응답은 `{ user: { sub, email, name } }`. FE 는 `id` 키로 다루는 게
 * 자연스러우니 여기서 한 번에 정규화 (`{ id, email, name }`).
 *
 * id 가 비어있으면 throw — 호출자가 "로그인됨" 으로 오인하지 않도록 strict.
 *
 * @returns {Promise<import('./api.types.js').MeResponse>}
 */
export const getMe = async () => {
  // Cache-Control: no-cache — 라이브 버그 대응 (auth-api 가 304 보내면 axios 응답
  // 의 data 가 undefined/이전 캐시로 흘러 invalid /me response throw). BE 도
  // Cache-Control: no-store 보내지만 클라이언트도 명시해 conditional GET 차단.
  const res = await authClient.get('/me', { headers: { 'Cache-Control': 'no-cache' } });
  // BE 가 `{ user: {...} }` 또는 user 객체 자체로 내려주는 경우 모두 흡수.
  const candidate = res.data?.user ? res.data : { user: res.data };
  const parsed = meResponseSchema.safeParse(candidate);
  if (!parsed.success) throw new Error('invalid /me response');
  const { user } = parsed.data;
  const rawId = user.id ?? user.sub;
  if (typeof rawId !== 'string' || rawId.length === 0) {
    throw new Error('invalid /me response: missing id');
  }
  // school-auth (#540) — 신규 필드는 null 정규화. createdAt 만 string|undefined 유지
  // (가입일은 표시 의무가 있는 곳에서만 사용 — 미수신을 빈 문자열로 오해하지 않게).
  return {
    id: rawId,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    nickname: user.nickname ?? null,
    studentId: user.studentId ?? null,
    schoolEmail: user.schoolEmail ?? null,
    schoolVerifiedAt: user.schoolVerifiedAt ?? null,
    createdAt: user.createdAt ?? undefined,
  };
};
