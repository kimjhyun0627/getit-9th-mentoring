import { MemberAvatar } from './MemberAvatar.jsx';

/**
 * 멤버 아바타 그룹 — 최대 N명 표시, 초과는 `+M` 칩.
 * 시안의 -space-x-2 + 흰 ring 패턴.
 *
 * @param {{
 *   members: Array<{ userId: string; name?: string | null }>;
 *   max?: number;
 *   size?: 'sm' | 'md';
 * }} props
 */
export const MemberAvatarGroup = ({ members, max = 4, size = 'sm' }) => {
  const safeMembers = Array.isArray(members) ? members : [];
  const visible = safeMembers.slice(0, max);
  const overflow = safeMembers.length - visible.length;

  if (safeMembers.length === 0) {
    return <span className="text-[11px] text-muted-foreground">멤버 없음</span>;
  }

  return (
    <div className="flex items-center -space-x-2" aria-label={`멤버 ${safeMembers.length}명`}>
      {visible.map((m) => (
        <MemberAvatar key={m.userId} userId={m.userId} name={m.name} size={size} />
      ))}
      {overflow > 0 ? (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-hairline bg-background text-[10px] font-medium text-muted-foreground ring-2 ring-background"
          aria-label={`외 ${overflow}명`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
};
