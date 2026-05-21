import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Header } from '../components/Header.jsx';
import { emojiFor, paletteFor } from '../data/palette.js';
import { cn } from '../lib/cn.js';
import { formatMeetAt } from '../lib/format.js';

/**
 * MePage 하위 컴포넌트들 — Shell / TabButton / Empty / MyApplicationCard.
 *
 * 본체와 분리하는 이유: MePage.jsx 가 300줄을 넘지 않도록.
 */

/**
 * 페이지 공통 shell — Header + 배경. PostDetailPage 의 PageShell 과 동일 톤.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export const MyPageShell = ({ children }) => {
  const [search, setSearch] = useState('');
  return (
    <div className="relative overflow-hidden min-h-screen">
      <div
        aria-hidden="true"
        className="blob"
        style={{
          width: 360,
          height: 360,
          top: -80,
          left: -60,
          background: 'radial-gradient(circle,#ff8aae 0%,transparent 65%)',
        }}
      />
      <div
        aria-hidden="true"
        className="blob"
        style={{
          width: 320,
          height: 320,
          top: 60,
          right: -40,
          background: 'radial-gradient(circle,#a5b4fc 0%,transparent 65%)',
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-dotted pointer-events-none" />
      <Header search={search} onSearchChange={setSearch} />
      {children}
    </div>
  );
};

/**
 * 탭 버튼 — 활성/비활성 톤.
 *
 * @param {{
 *   active: boolean;
 *   onClick: () => void;
 *   children: import('react').ReactNode;
 *   count: number | null;
 * }} props
 */
export const TabButton = ({ active, onClick, children, count }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-display font-extrabold transition',
      active
        ? 'bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 shadow'
        : 'bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 text-slate-700 dark:text-slate-200 hover:scale-[1.02]',
    )}
  >
    {children}
    {typeof count === 'number' ? (
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[11px] font-display',
          active ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/10',
        )}
      >
        {count}
      </span>
    ) : null}
  </button>
);

/**
 * 401 → SSO 리다이렉트 안내 placeholder — #406.
 *
 * MePage 본체 + 탭(MyCreatedTab/MyAppliedTab) 셋이 동일 카피를 썼어서 추출.
 * `role="status"` 로 스크린리더가 polite 하게 읽도록.
 */
export const RedirectingNotice = () => (
  <p role="status" className="mt-20 text-center text-slate-500 dark:text-slate-400 font-round">
    로그인 페이지로 이동 중…
  </p>
);

/**
 * 빈 상태 placeholder.
 *
 * @param {{ emoji: string; title: string; body: string }} props
 */
export const MePageEmpty = ({ emoji, title, body }) => (
  <div className="rounded-3xl bg-white/80 dark:bg-white/5 ring-1 ring-slate-900/5 dark:ring-white/10 px-6 py-12 text-center shadow-sm">
    <p className="text-3xl" aria-hidden="true">
      {emoji}
    </p>
    <p className="mt-3 font-display font-extrabold text-lg text-slate-900 dark:text-white">
      {title}
    </p>
    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 font-round">{body}</p>
  </div>
);

/**
 * 신청 상태 뱃지 (#500/#506).
 *
 * @param {{ status?: string }} props
 */
const APP_STATUS_LABEL = {
  PENDING: { label: '방장 승인 대기', cls: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: '입장 확정', cls: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: '신청 거절', cls: 'bg-slate-200 text-slate-700' },
};
const ApplicationStatusBadge = ({ status }) => {
  const entry = APP_STATUS_LABEL[status];
  if (!entry) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-display font-extrabold',
        entry.cls,
      )}
    >
      {entry.label}
    </span>
  );
};

/**
 * 신청 카드 — 작은 카드 + "취소" CTA.
 *
 * 풀 모집 카드(MeetupCard) 보다 정보 밀도 높게.
 * 모집글 status 가 CLOSED 면 취소 CTA 숨김 (이미 끝난 모임).
 *
 * #500/#506: status 뱃지 (PENDING/APPROVED/REJECTED) + openChatUrl 노출 분기.
 *
 * @param {{
 *   item: {
 *     id: string;
 *     status?: 'PENDING' | 'APPROVED' | 'REJECTED';
 *     createdAt: string;
 *     post: {
 *       id: string;
 *       title: string;
 *       meetAt: string;
 *       status: string;
 *       capacity: number;
 *       currentCapacity: number;
 *       openChatUrl?: string;
 *       applicationPolicy?: 'FIRST_COME' | 'APPROVAL';
 *       tags?: { id: string; name: string }[];
 *     };
 *   };
 *   onCancel: () => void;
 *   isPending: boolean;
 * }} props
 */
export const MyApplicationCard = ({ item, onCancel, isPending }) => {
  const post = item.post;
  const palette = paletteFor(post);
  const myStatus = item.status ?? 'APPROVED';
  // Gemini PR #510: REJECTED 도 사용자가 목록 정리할 수 있게 취소 허용. BE 가 capacity 영향 X.
  const canCancel = post.status !== 'CLOSED';
  return (
    <li
      data-testid={`my-application-${item.id}`}
      className={cn(
        'rounded-3xl p-5 relative overflow-hidden shadow-md ring-1 ring-slate-900/5 dark:ring-white/10',
        palette.gradient,
        palette.text,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-round font-bold tracking-wider',
            palette.chip,
          )}
        >
          🗓 {formatMeetAt(post.meetAt)}
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
      <div className="mt-3 flex items-start gap-3">
        <span aria-hidden="true" className="emoji text-3xl">
          {emojiFor(post)}
        </span>
        <h3 className="font-display font-extrabold text-lg leading-tight">{post.title}</h3>
      </div>
      {/* #500/#506 — 정책이 APPROVAL 이거나 status 가 APPROVED 가 아니면 상태 뱃지 노출. */}
      {myStatus !== 'APPROVED' || (post.applicationPolicy ?? 'FIRST_COME') === 'APPROVAL' ? (
        <div className="mt-2">
          <ApplicationStatusBadge status={myStatus} />
        </div>
      ) : null}
      {/* APPROVED + openChatUrl 노출 — 정책 무관. BE 가 노출 여부 결정. */}
      {myStatus === 'APPROVED' && post.openChatUrl ? (
        <a
          href={post.openChatUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-display font-extrabold whitespace-nowrap',
            palette.chip,
          )}
        >
          💬 오픈채팅 열기 <span aria-hidden="true">↗</span>
        </a>
      ) : null}
      {/* #332 — 좁은 모바일에서도 두 액션이 깨지지 않게 wrap 허용 */}
      <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
        <Link
          to={`/posts/${post.id}`}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-display font-extrabold whitespace-nowrap',
            palette.chip,
          )}
        >
          상세 보기 <span aria-hidden="true">→</span>
        </Link>
        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            // #311 — disabled: opacity 대신 단색 muted (그라데이션 위 가독성 보장)
            className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-white/15 text-slate-700 dark:text-slate-100 px-3 py-1.5 text-xs font-display font-extrabold whitespace-nowrap disabled:bg-slate-200 disabled:text-slate-500 disabled:dark:bg-slate-700 disabled:dark:text-slate-300 disabled:cursor-not-allowed"
          >
            {isPending ? '취소 중…' : '신청 취소'}
          </button>
        ) : (
          <span className="text-xs font-round font-bold opacity-80">모집 종료</span>
        )}
      </div>
    </li>
  );
};
