import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../../lib/api.js';
import { useBoardMemberMutations } from '../../lib/useBoardMemberMutations.js';

/**
 * 멤버 다이얼로그 + 초대/추방 mutation 묶음.
 *
 *  - membersOpen / membersError state 관리
 *  - membersQuery 는 다이얼로그 open 시점에만 활성 (불필요한 GET 차단)
 *  - membersQuery 실패 시 dialog 안에서 친화 카피로 안내 (빈 목록으로 가리지 않음)
 *
 * @param {{ projectId: string }} args
 */
export const useMembersDialog = ({ projectId }) => {
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersError, setMembersError] = useState(/** @type {string | null} */ (null));

  const membersQuery = useQuery({
    queryKey: ['members', projectId],
    queryFn: async () => {
      const res = await api.listMembers(projectId);
      return res.data?.members ?? [];
    },
    enabled: membersOpen && Boolean(projectId),
  });

  // membersQuery 실패 시 dialog 안에서 사용자 친화 카피로 안내 — 빈 목록으로 가리지 않음.
  // (조회 성공 전엔 projectQuery.members 를 fallback 으로 사용해 "멤버 없음" 오해 방지.)
  useEffect(() => {
    if (membersOpen && membersQuery.isError && !membersError) {
      setMembersError('멤버 목록을 불러오지 못했어. 잠시 후 다시 시도해줘.');
    }
  }, [membersOpen, membersQuery.isError, membersError]);

  const memberMut = useBoardMemberMutations({
    projectId,
    onError: setMembersError,
    onSuccess: () => setMembersError(null),
  });

  return {
    membersOpen,
    membersError,
    membersQuery,
    memberMut,
    openMembers: () => {
      setMembersOpen(true);
      setMembersError(null);
    },
    closeMembers: () => {
      setMembersOpen(false);
      setMembersError(null);
    },
  };
};
