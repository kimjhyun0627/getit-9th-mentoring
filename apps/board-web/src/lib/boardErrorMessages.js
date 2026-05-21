/**
 * board mutation 에러 메시지 매핑. 카드 PATCH / 멤버 초대·추방의 BE 응답을
 * 사용자 친화 카피로 변환.
 */

/**
 * 카드 편집/저장 시 API 에러 → 사용자 카피.
 *
 * @param {unknown} err
 * @returns {string}
 */
export const toFriendlyCardError = (err) => {
  const status = /** @type {{ response?: { status?: number } }} */ (err)?.response?.status;
  const code = /** @type {{ response?: { data?: { error?: string } } }} */ (err)?.response?.data
    ?.error;
  if (code === 'AssigneeNotMember' || status === 422) return '담당자는 프로젝트 멤버여야 해.';
  // #253: 다른 사용자가 먼저 수정함 — 새로고침 안내.
  if (status === 409 || code === 'Conflict')
    return '다른 사람이 먼저 이 카드를 수정했어. 새로고침하고 다시 시도해줘.';
  if (status === 400) return '입력을 다시 확인해줘.';
  if (status === 403) return '권한이 없어.';
  if (status === 404) return '카드를 찾을 수 없어.';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 났어. 잠시 후 다시 시도해줘.';
  return '저장하지 못했어. 잠시 후 다시 시도해줘.';
};

/**
 * 멤버 초대/추방 시 API 에러 → 사용자 카피.
 *
 * @param {unknown} err
 * @returns {string}
 */
export const toFriendlyMemberError = (err) => {
  const status = /** @type {{ response?: { status?: number } }} */ (err)?.response?.status;
  const code = /** @type {{ response?: { data?: { error?: string } } }} */ (err)?.response?.data
    ?.error;
  if (code === 'AlreadyMember' || status === 409) return '이미 멤버야.';
  if (code === 'OwnerOnly' || status === 403) return 'OWNER만 할 수 있는 동작이야.';
  // OwnerCannotLeave 는 OWNER 본인 탈퇴 시도에만 해당. 그 외 400 (검증 오류 등) 은 일반 카피로.
  if (code === 'OwnerCannotLeave') return 'OWNER는 탈퇴할 수 없어 (소유권 이전 먼저).';
  if (status === 400) return '입력을 다시 확인해줘.';
  if (status === 404) return '대상을 찾을 수 없어.';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 났어. 잠시 후 다시 시도해줘.';
  return '처리하지 못했어. 잠시 후 다시 시도해줘.';
};
