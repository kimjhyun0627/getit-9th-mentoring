/**
 * 신청 (applications) + 방장 액션 도메인 API.
 *
 * POST   /api/applications              — 신청 (JWT)
 * DELETE /api/applications/:id          — 신청 취소
 * GET    /api/posts/:id/applicants      — 신청자 목록 (owner only, #245)
 * PATCH  /api/applications/:id/approve  — 승인 (방장 APPROVAL, #500/#502)
 * PATCH  /api/applications/:id/reject   — 거절 (방장 APPROVAL, #500/#502)
 * POST   /api/posts/:id/no-shows        — 노쇼 신고 (owner only, #247)
 */
import { client } from './api.core.js';

/**
 * POST /api/applications — 매칭 신청. JWT 필요.
 *
 * @param {string} postId
 * @returns {Promise<import('./api.types.js').ApplicationResponse>}
 */
export const applyPost = async (postId) => {
  const res = await client.post('/applications', { postId });
  return res.data;
};

/**
 * DELETE /api/applications/:id — 신청 취소. 본인 application id 필요.
 *
 * @param {string} applicationId
 * @returns {Promise<void>}
 */
export const cancelApplication = async (applicationId) => {
  await client.delete(`/applications/${encodeURIComponent(applicationId)}`);
};

/**
 * 신청자 목록 (owner only) — #245.
 *
 * #500: 응답에 `applicationPolicy` + `items[].status` 포함.
 *
 * @param {string} id
 * @returns {Promise<{ items: Array<{
 *   id: string;
 *   userId: string;
 *   status: 'PENDING' | 'APPROVED' | 'REJECTED';
 *   createdAt: string;
 *   noShow: boolean;
 *   noShowCount: number;
 * }>; total: number; applicationPolicy: 'FIRST_COME' | 'APPROVAL' }>}
 */
export const listApplicants = async (id) => {
  const res = await client.get(`/posts/${encodeURIComponent(id)}/applicants`);
  // 응답 shape 가 깨져도 호출자가 `items.map` 등에서 즉시 폭발하지 않도록
  // 최소 sanitization. plain object 만 spread — 배열/문자열/null 은 빈 객체로
  // 떨어뜨려서 이상한 키 전파 차단. total / applicationPolicy 는 그대로 통과.
  const data = res.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : {};
  return {
    ...data,
    items: Array.isArray(data.items) ? data.items : [],
  };
};

/**
 * 신청 승인 (방장, APPROVAL 정책) — #500/#502.
 *
 * @param {string} applicationId
 */
export const approveApplication = async (applicationId) => {
  const res = await client.patch(`/applications/${encodeURIComponent(applicationId)}/approve`);
  return res.data;
};

/**
 * 신청 거절 (방장, APPROVAL 정책) — #500/#502.
 *
 * @param {string} applicationId
 */
export const rejectApplication = async (applicationId) => {
  const res = await client.patch(`/applications/${encodeURIComponent(applicationId)}/reject`);
  return res.data;
};

/**
 * 노쇼 신고 (owner only) — #247.
 *
 * @param {string} id
 * @param {string[]} applicantIds
 */
export const reportNoShows = async (id, applicantIds) => {
  const res = await client.post(`/posts/${encodeURIComponent(id)}/no-shows`, {
    applicantIds,
  });
  return res.data;
};
