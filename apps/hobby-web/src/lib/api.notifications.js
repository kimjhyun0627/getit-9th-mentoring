/**
 * 알림 (notifications) 도메인 API.
 *
 * GET    /api/notifications              — 본인 알림 (cursor 페이지네이션)
 * PATCH  /api/notifications/:id/read     — 단건 읽음
 * POST   /api/notifications/read-all     — 본인 unread 일괄 읽음
 */
import { client } from './api.core.js';
import { assertListShape } from './api.helpers.js';

/**
 * GET /api/notifications — 본인 알림. JWT 필요.
 *
 * @param {{ cursor?: string; limit?: number; unreadOnly?: 'true'|'false' }} [params]
 */
export const listNotifications = async (params = {}) => {
  const res = await client.get('/notifications', { params });
  assertListShape(res.data);
  return res.data;
};

/**
 * PATCH /api/notifications/:id/read — 단건 읽음 처리.
 *
 * @param {string} id
 */
export const markNotificationRead = async (id) => {
  await client.patch(`/notifications/${encodeURIComponent(id)}/read`);
};

/**
 * POST /api/notifications/read-all — 본인 unread 일괄 읽음.
 */
export const markAllNotificationsRead = async () => {
  const res = await client.post('/notifications/read-all');
  return res.data;
};
