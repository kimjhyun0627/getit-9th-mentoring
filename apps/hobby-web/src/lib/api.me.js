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
 */
const meUserSchema = z
  .object({
    id: z.string().min(1).optional(),
    sub: z.string().min(1).optional(),
    email: z.string().nullish(),
    name: z.string().nullish(),
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
  return { id: rawId, email: user.email ?? undefined, name: user.name ?? undefined };
};
