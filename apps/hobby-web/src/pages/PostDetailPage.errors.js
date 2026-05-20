/**
 * 상세 페이지 에러 → 한국어 안내 메시지 매핑.
 * BE 에러 코드 (`apps/hobby-api/src/routes/applications.js`, `posts.js`) 와 1:1.
 * 메시지는 사용자 친화 — 기술 디테일 노출 X.
 */

/**
 * @param {unknown} err - axios error (may have err.response.status / err.response.data.error)
 * @returns {{ status: number | null; code: string | null }}
 */
const extract = (err) => {
  if (!err || typeof err !== 'object') return { status: null, code: null };
  const e = /** @type {{ response?: { status?: number; data?: { error?: string } } }} */ (err);
  return {
    status: e.response?.status ?? null,
    code: e.response?.data?.error ?? null,
  };
};

/**
 * 게시글 fetch 에러 → 메시지.
 *
 * @param {unknown} err
 * @returns {string}
 */
export const fetchErrorMessage = (err) => {
  const { status } = extract(err);
  if (status === 404) return '모임을 찾을 수 없어. 이미 삭제됐을 수 있어.';
  if (status === 401) return '로그인이 필요해.';
  return '잠시 후 다시 시도해줘.';
};

/**
 * 신청 mutation 에러 → 메시지. null 이면 표시 X.
 *
 * @param {unknown} err
 * @returns {string | null}
 */
export const applyErrorMessage = (err) => {
  if (!err) return null;
  const { status, code } = extract(err);
  if (code === 'PostFull') return '한 발 늦었네. 이미 정원이 마감됐어.';
  if (code === 'OwnerCannotApply') return '내가 만든 모임에는 신청 못해.';
  if (code === 'AlreadyApplied') return '이미 신청한 모임이야.';
  if (code === 'PostNotOpen') return '지금은 신청을 받지 않는 모임이야.';
  if (status === 401) return '로그인 후 다시 시도해줘.';
  if (status === 404) return '모임이 사라졌어.';
  return '신청 실패. 잠시 후 다시 시도해줘.';
};

/**
 * 신청 취소 mutation 에러 → 메시지.
 *
 * @param {unknown} err
 * @returns {string | null}
 */
export const cancelErrorMessage = (err) => {
  if (!err) return null;
  const { status } = extract(err);
  if (status === 401) return '로그인 후 다시 시도해줘.';
  if (status === 403) return '본인 신청만 취소할 수 있어.';
  if (status === 404) return '이미 취소된 신청이야.';
  return '신청 취소 실패. 잠시 후 다시 시도해줘.';
};
