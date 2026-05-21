import {
  BoardColumnCreateInput,
  BoardColumnUpdateInput,
  CardCreateInput,
  CardMoveInput,
  CardUpdateInput,
  ProjectMemberInput,
  ProjectUpdateInput,
} from '@getit/schemas/board';
import axios from 'axios';

/**
 * board-web 전용 axios 인스턴스.
 * - baseURL: VITE_API_URL 우선, 없으면 '/api' (prod 동일 origin 가정)
 * - withCredentials: true — JWT는 HttpOnly 쿠키. `.get-it.cloud` 도메인 공유 (SSO).
 */
// `||` 사용 — `VITE_API_URL=""` (빈 문자열) 도 fallback `'/api'` 로 처리.
const baseURL = import.meta.env?.VITE_API_URL || '/api';

export const client = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10000,
});

/**
 * 401 시 상위 콜백 실행 (옵션). 보통 auth.get-it.cloud 로 redirect.
 *
 * @type {{ onUnauthorized: (() => void) | null }}
 */
const handlers = { onUnauthorized: null };

/**
 * 401 콜백 등록.
 *
 * @param {() => void} fn
 */
export const setUnauthorizedHandler = (fn) => {
  handlers.onUnauthorized = fn;
};

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && handlers.onUnauthorized) {
      handlers.onUnauthorized();
    }
    return Promise.reject(err);
  },
);

/**
 * Zod 스키마로 페이로드를 검증해 잘못된 요청이 서버까지 가지 않게 한다.
 * - 실패 시 reject 된 Promise 반환 → 호출부의 mutation onError 가 정상 동작
 * - 성공 시 parsed value (trim, default 등 정규화된 값) 반환
 *
 * @template T
 * @param {{ safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: import('zod').ZodError } }} schema
 * @param {unknown} body
 * @returns {Promise<T>}
 */
const parseOrReject = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    const err = new Error(`잘못된 요청 페이로드: ${result.error.message}`);
    err.name = 'ValidationError';
    err.issues = result.error.issues;
    return Promise.reject(err);
  }
  return Promise.resolve(result.data);
};

/**
 * board-api 호출 헬퍼.
 * - 프로젝트/멤버/컬럼: `/projects/...` 하위
 * - 카드: `/cards` 평탄 (board-api 라우팅 참조)
 * 인증은 HttpOnly 쿠키 (`withCredentials`).
 */
export const api = {
  /** 내가 멤버인 프로젝트 목록. */
  listProjects: () => client.get('/projects'),
  /**
   * 프로젝트 생성 (OWNER로 등록 + Todo/Doing/Done 컬럼 자동 생성).
   *
   * @param {{ name: string; description?: string }} body
   */
  createProject: (body) => client.post('/projects', body),
  /**
   * 프로젝트 단건 조회.
   *
   * @param {string} projectId
   */
  getProject: (projectId) => client.get(`/projects/${projectId}`),
  /**
   * 프로젝트 단건 수정 (name / description). 멤버 누구나.
   *
   * @param {string} projectId
   * @param {{ name?: string; description?: string | null }} body
   */
  updateProject: (projectId, body) =>
    parseOrReject(ProjectUpdateInput, body).then((parsed) =>
      client.patch(`/projects/${projectId}`, parsed),
    ),
  /**
   * 프로젝트 삭제 (OWNER 전용 — 서버가 게이트).
   *
   * @param {string} projectId
   */
  deleteProject: (projectId) => client.delete(`/projects/${projectId}`),
  /**
   * 프로젝트 컬럼 목록 (order asc).
   *
   * @param {string} projectId
   */
  listColumns: (projectId) => client.get(`/projects/${projectId}/columns`),
  /**
   * 컬럼 생성 — order 미입력 시 서버가 마지막 + 1000 으로 자동 배치.
   *
   * @param {string} projectId
   * @param {{ name: string; order?: number }} body
   */
  createColumn: (projectId, body) =>
    parseOrReject(BoardColumnCreateInput, body).then((parsed) =>
      client.post(`/projects/${projectId}/columns`, parsed),
    ),
  /**
   * 컬럼 수정 (name / order).
   *
   * @param {string} projectId
   * @param {string} columnId
   * @param {{ name?: string; order?: number }} body
   */
  updateColumn: (projectId, columnId, body) =>
    parseOrReject(BoardColumnUpdateInput, body).then((parsed) =>
      client.patch(`/projects/${projectId}/columns/${columnId}`, parsed),
    ),
  /**
   * 컬럼 삭제. 마지막 1개는 409 (LastColumn) 로 막힌다.
   *
   * @param {string} projectId
   * @param {string} columnId
   */
  deleteColumn: (projectId, columnId) =>
    client.delete(`/projects/${projectId}/columns/${columnId}`),
  /**
   * 프로젝트 멤버 목록 (담당자 picker / 멤버 관리용).
   *
   * @param {string} projectId
   */
  listMembers: (projectId) => client.get(`/projects/${projectId}/members`),
  /**
   * 프로젝트 멤버 초대 (OWNER 전용).
   *
   * @param {string} projectId
   * @param {{ userId: string; role?: 'OWNER'|'MEMBER' }} body
   */
  inviteMember: (projectId, body) =>
    parseOrReject(ProjectMemberInput, body).then((parsed) =>
      client.post(`/projects/${projectId}/members`, parsed),
    ),
  /**
   * 프로젝트 멤버 제거 (본인 탈퇴 또는 OWNER 추방).
   *
   * @param {string} projectId
   * @param {string} userId
   */
  // userId 에 예약문자가 들어와도 안전하도록 path 세그먼트 인코딩.
  removeMember: (projectId, userId) =>
    client.delete(
      `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    ),
  /**
   * 컬럼별 카드 목록 (order asc).
   *
   * @param {string} columnId
   */
  listCards: (columnId) => client.get('/cards', { params: { columnId } }),
  /**
   * 프로젝트 전체 카드 batch (#258) — { cardsByColumn: Record<columnId, Card[]> }.
   * BE 한 번 호출로 모든 컬럼 카드를 받아 N+1 회피.
   *
   * @param {string} projectId
   */
  listCardsBatch: (projectId) => client.get('/cards', { params: { projectId } }),
  /**
   * 카드 생성. zod 검증을 통과한 페이로드만 서버로 보낸다.
   *
   * @param {{ columnId: string; title: string; description?: string | null; assigneeId?: string | null }} body
   */
  createCard: (body) =>
    parseOrReject(CardCreateInput, body).then((parsed) => client.post('/cards', parsed)),
  /**
   * 카드 단건 조회 — useBoardCardMutations 가 cache miss 시 expectedUpdatedAt fallback 으로 사용 (#455).
   *
   * @param {string} cardId
   */
  getCard: (cardId) => client.get(`/cards/${cardId}`),
  /**
   * 카드 수정 (title / description / assigneeId 중 1+).
   *
   * @param {string} cardId
   * @param {{ title?: string; description?: string | null; assigneeId?: string | null }} body
   */
  updateCard: (cardId, body) =>
    parseOrReject(CardUpdateInput, body).then((parsed) => client.patch(`/cards/${cardId}`, parsed)),
  /**
   * 카드 삭제.
   *
   * @param {string} cardId
   */
  deleteCard: (cardId) => client.delete(`/cards/${cardId}`),
  /**
   * 카드 이동 (between-keys). order 미지정 시 대상 컬럼 끝으로.
   *
   * @param {string} cardId
   * @param {{ columnId: string; order?: number }} body
   */
  moveCard: (cardId, body) =>
    parseOrReject(CardMoveInput, body).then((parsed) =>
      client.patch(`/cards/${cardId}/move`, parsed),
    ),
};
