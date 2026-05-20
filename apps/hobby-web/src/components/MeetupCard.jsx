import { Link } from 'react-router-dom';

import { emojiFor, paletteFor } from '../data/palette.js';
import { cn } from '../lib/cn.js';
import { formatMeetAt, initialOf } from '../lib/format.js';

/**
 * 모집 카드 — 시안 (playful.html) 의 <article class="card ..."> 1:1 변환.
 * 색은 palette.js 가 태그/id 로 결정. CLOSED 상태면 is-closed (회색 + 비활성).
 *
 * @param {{
 *   post: {
 *     id: string;
 *     title: string;
 *     meetAt: string;
 *     capacity: number;
 *     currentCapacity: number;
 *     status: 'RECRUITING' | 'FULL' | 'CLOSED';
 *     tags: { id: string; name: string }[];
 *     owner?: { nickname?: string; label?: string; noShowCount?: number };
 *     location?: string;
 *   };
 * }} props
 */
export const MeetupCard = ({ post }) => {
  const palette = paletteFor(post);
  const emoji = emojiFor(post);
  const closed = post.status === 'CLOSED' || post.status === 'FULL';
  const meetLabel = formatMeetAt(post.meetAt);
  const ownerNick = post.owner?.nickname ?? '익명';
  const ownerLabel = post.owner?.label ?? '';
  const noShow = post.owner?.noShowCount ?? 0;

  return (
    <div
      role="group"
      data-testid={`meetup-card-${post.id}`}
      aria-label={`모집: ${post.title}`}
      aria-disabled={closed || undefined}
      className={cn(
        'card rounded-[28px] p-6 relative overflow-hidden shadow-xl',
        palette.gradient,
        palette.text,
        palette.tilt,
        closed && 'is-closed',
      )}
    >
      <div
        aria-hidden="true"
        className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/15"
      />
      <div
        aria-hidden="true"
        className="absolute top-8 right-10 h-12 w-12 rounded-full bg-white/15"
      />

      <div className="flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-round font-bold tracking-wider backdrop-blur',
            palette.chip,
          )}
        >
          <span aria-hidden="true">🗓</span> {meetLabel}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-display font-extrabold',
            palette.pill,
          )}
        >
          {`${post.currentCapacity}/${post.capacity}`}
        </span>
      </div>

      <div className="mt-5 flex items-start gap-3">
        <span aria-hidden="true" className="emoji text-5xl drop-shadow-md">
          {emoji}
        </span>
        <div>
          <h3 className="font-display font-extrabold text-xl leading-tight">{post.title}</h3>
          {post.location ? (
            <p className="mt-1 opacity-90 font-round text-sm">{post.location}</p>
          ) : null}
        </div>
      </div>

      {post.tags?.length ? (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="태그">
          {post.tags.map((t) => (
            <li
              key={t.id}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-round font-bold',
                palette.chip,
              )}
            >
              #{t.name}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 rounded-full bg-amber-200 text-amber-900 font-display font-extrabold items-center justify-center text-sm"
          >
            {initialOf(ownerNick)}
          </span>
          <span className="text-sm font-round font-bold">
            {ownerNick}
            {ownerLabel ? ` · ${ownerLabel}` : ''}
            {noShow > 0 ? (
              <span className="ml-1 text-[10px] rounded-full bg-amber-300 text-amber-900 px-1.5 py-0.5 align-middle">
                ⚠ 노쇼 {noShow}회
              </span>
            ) : null}
          </span>
        </div>
        {closed ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-display font-extrabold text-sm',
              palette.pill,
            )}
          >
            {post.status === 'FULL' ? '정원 마감' : '모집 종료'}
          </span>
        ) : (
          <Link
            to={`/posts/${post.id}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-display font-extrabold text-sm shadow',
              palette.btn,
            )}
          >
            신청{' '}
            <span aria-hidden="true" className="arrow">
              →
            </span>
          </Link>
        )}
      </div>
    </div>
  );
};
