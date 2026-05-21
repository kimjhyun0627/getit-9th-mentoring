import { MembersDialog } from '../../components/MembersDialog.jsx';

/**
 * 멤버 다이얼로그 + invite/remove mutation 결합 컨테이너.
 *
 *  - 멤버 detail (role 포함) 은 GET /members 응답 우선,
 *    실패/대기 시 projectQuery 의 멤버로 fallback.
 *  - projectMembers 가 role 을 들고 오면 그걸 신뢰. 없을 때만 ownerId 로 보수적 추정.
 *  - #438: invite 실패해도 input 비워지는 문제 — onInvite 가 성공 여부 반환.
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   project: any;
 *   projectMembers: Array<any>;
 *   membersQuery: { isSuccess: boolean; data?: Array<any> };
 *   memberMut: any;
 *   serverError: string | null;
 * }} props
 */
export const BoardMembersDialogContainer = ({
  open,
  onClose,
  project,
  projectMembers,
  membersQuery,
  memberMut,
  serverError,
}) => {
  // fallback 변환은 membersQuery 가 아직 성공하지 않은 경우에만 수행 — 성공 시엔 불필요한 map 회피.
  const members = membersQuery.isSuccess
    ? membersQuery.data
    : projectMembers.map((m) => ({
        userId: m.userId,
        role:
          m.role === 'OWNER' || m.role === 'MEMBER'
            ? m.role
            : m.userId === project?.ownerId
              ? 'OWNER'
              : 'MEMBER',
        name: m.name ?? null,
      }));

  return (
    <MembersDialog
      open={open}
      onClose={onClose}
      role={project?.role ?? 'MEMBER'}
      members={members}
      currentUserId={project?.currentUserId ?? null}
      onInvite={(userId) =>
        memberMut.invite
          .mutateAsync({ userId })
          .then(() => true)
          .catch(() => false)
      }
      onRemove={(userId) => memberMut.remove.mutateAsync({ userId }).catch(() => {})}
      inviting={memberMut.invite.isPending}
      removingUserId={memberMut.remove.isPending ? memberMut.remove.variables?.userId : null}
      serverError={serverError}
    />
  );
};
