/**
 * 8자리 학번 사용자 마이그레이션 가드 — #573.
 *
 * 정책:
 *  - me query 의 `studentIdLegacy === true` 면 `<StudentIdMigrationModal>` 을 children 위에 overlay.
 *  - children 은 unmount 하지 않음 — Router state / form state 보존. 모달이 시각적으로 가림.
 *  - 성공 submit → `invalidateQueries(['me'])` → BE 가 false 로 응답하면 모달 자동 언마운트.
 *
 * 상위 배치:
 *  - `SchoolAuthGate` 안쪽에 둔다. 학교 인증된 사용자에게만 의미 있는 가드라.
 *  - me 캐시 키 `['me']` 는 SchoolAuthGate 와 공유 — 중복 fetch 없음.
 *
 * Fail-open 정책 (SchoolAuthGate 와 대비):
 *  - me 가 settled 안 됐거나 키 누락이면 모달 X.
 *  - 401/500/network 오류일 때도 모달 X — 학번 입력보다 SchoolAuthGate / SSO 흐름이 먼저 결정.
 *  - 즉 이 가드는 "studentIdLegacy === true 확정" 일 때만 트리거.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { api } from '../lib/api.js';

import { StudentIdMigrationModal } from './StudentIdMigrationModal.jsx';

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export const StudentIdMigrationGate = ({ children }) => {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 60_000,
  });

  const handleSubmit = useCallback(
    async ({ studentId }) => {
      await api.updateStudentId({ studentId });
      // BE 가 studentIdLegacy=false 로 마킹 — me 새로고침으로 모달 자동 언마운트.
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    [queryClient],
  );

  const showModal = meQuery.data?.studentIdLegacy === true;

  return (
    <>
      {children}
      {showModal ? <StudentIdMigrationModal onSubmit={handleSubmit} /> : null}
    </>
  );
};
