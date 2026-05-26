/**
 * hobby-web API 통합 진입점.
 *
 * 책임:
 *  - 도메인별 모듈 (posts/applications/notifications/me) 을 묶어 `api` 객체로 노출.
 *  - 기존 호출자 호환을 위해 `client` / `refreshAccessToken` /
 *    `assertJsonObject` / `assertListShape` / `setUnauthorizedHandler` 도 re-export.
 *
 * 파일 분리:
 *  - axios 인스턴스 + interceptor → `api.core.js`
 *  - 헬퍼 / 응답 가드            → `api.helpers.js`
 *  - 401 refresh 인터셉터 로직   → `api.refresh.js`
 *  - JSDoc typedef                → `api.types.js`
 *  - 도메인 API                   → `api.posts.js` / `api.applications.js` /
 *                                    `api.notifications.js` / `api.me.js`
 *
 * 참고: POST body 의 `meetAt` 은 BE Zod 가 ISO 8601 문자열 (offset 포함) 을
 * 요구. FE 에서 `<input type="datetime-local">` 의 로컬 시각을 그대로 보내면
 * tz 누락으로 거절되니, `new Date(local).toISOString()` 변환 필수.
 */
import {
  approveApplication,
  applyPost,
  cancelApplication,
  listApplicants,
  rejectApplication,
  reportNoShows,
} from './api.applications.js';
import { client, refreshAccessToken, setUnauthorizedHandler } from './api.core.js';
import { assertJsonObject, assertListShape } from './api.helpers.js';
import { getMe, listMyApplications, listMyPosts, updateStudentId } from './api.me.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './api.notifications.js';
import { closePost, createPost, getPost, listPosts, updatePost } from './api.posts.js';

// re-export — 기존 외부 호출자 호환.
export { assertJsonObject, assertListShape, client, refreshAccessToken, setUnauthorizedHandler };

/**
 * 페이지에서 axios 를 직접 다루지 않고 이 헬퍼만 import 한다.
 *
 * 도메인별 모듈에서 개별 함수를 import 할 수도 있지만, 호출자 호환 + 단일
 * 진입점 가독성을 위해 모든 함수를 한 객체로 묶어 노출한다.
 */
export const api = {
  // posts
  listPosts,
  getPost,
  createPost,
  updatePost,
  closePost,
  // applications + 방장 액션
  applyPost,
  cancelApplication,
  listApplicants,
  approveApplication,
  rejectApplication,
  reportNoShows,
  // notifications
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  // me
  listMyPosts,
  listMyApplications,
  getMe,
  updateStudentId,
};
