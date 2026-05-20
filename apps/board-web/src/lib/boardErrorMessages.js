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
  if (code === 'AssigneeNotMember' || status === 422) return '담당자는 프로젝트 멤버여야 합니다.';
  if (status === 400) return '입력을 확인해 주세요.';
  if (status === 403) return '권한이 없습니다.';
  if (status === 404) return '카드를 찾을 수 없습니다.';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  return '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
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
  if (code === 'AlreadyMember' || status === 409) return '이미 멤버입니다.';
  if (code === 'OwnerOnly' || status === 403) return 'OWNER만 할 수 있는 동작입니다.';
  // OwnerCannotLeave 는 OWNER 본인 탈퇴 시도에만 해당. 그 외 400 (검증 오류 등) 은 일반 카피로.
  if (code === 'OwnerCannotLeave') return 'OWNER는 탈퇴할 수 없습니다 (소유권 이전 먼저).';
  if (status === 400) return '입력을 확인해 주세요.';
  if (status === 404) return '대상을 찾을 수 없습니다.';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  return '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
};
