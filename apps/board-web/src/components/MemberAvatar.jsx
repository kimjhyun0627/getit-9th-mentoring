import { cn } from '../lib/cn.js';
import { avatarTone, initials } from '../lib/initials.js';

/**
 * 멤버 아바타 (이니셜 + 결정적 톤).
 * 시안의 `-space-x-2` 그룹에 잘 어울리는 ring 적용.
 *
 * @param {{
 *   name?: string | null;
 *   userId: string;
 *   size?: 'sm' | 'md';
 *   className?: string;
 *   title?: string;
 * }} props
 */
export const MemberAvatar = ({ name, userId, size = 'md', className, title }) => {
  const sizeClass = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-[11px]';
  return (
    <span
      title={title ?? name ?? userId}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium ring-2 ring-background',
        sizeClass,
        avatarTone(userId || name || ''),
        className,
      )}
    >
      {initials(name ?? userId)}
    </span>
  );
};
