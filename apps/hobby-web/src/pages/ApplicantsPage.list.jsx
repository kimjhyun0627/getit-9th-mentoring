import { useEffect, useRef } from 'react';

import { cn } from '../lib/cn.js';

/**
 * ApplicantsPage 신청자 리스트 — #443/#445/#500.
 *
 * 변경 (#500):
 *  - APPROVAL 정책 모임은 PENDING 신청자에 승인/거절 버튼.
 *  - 상태 뱃지 (PENDING/APPROVED/REJECTED) — 정책 무관 표시.
 *  - 노쇼 신고 체크박스는 APPROVED 만 대상 (PENDING/REJECTED 는 모임에 못 옴).
 *
 * Touch target 44px (Apple HIG): 체크박스 h-11 w-11.
 */

/**
 * 전체선택/해제 + 카운트 헤더.
 *
 * @param {{
 *   reportableCount: number;
 *   selectedCount: number;
 *   onToggleAll: () => void;
 *   disabled: boolean;
 * }} props
 */
const SelectAllHeader = ({ reportableCount, selectedCount, onToggleAll, disabled }) => {
  const ref = useRef(/** @type {HTMLInputElement | null} */ (null));
  const allChecked = reportableCount > 0 && selectedCount === reportableCount;
  const partial = selectedCount > 0 && selectedCount < reportableCount;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);

  return (
    <div
      className="mt-6 flex items-center gap-3 rounded-2xl bg-white/70 dark:bg-white/5 ring-1 ring-slate-900/5 dark:ring-white/10 px-3 py-2"
      aria-controls="applicant-list"
    >
      <label className="inline-flex items-center justify-center h-11 w-11 cursor-pointer">
        <input
          ref={ref}
          type="checkbox"
          className="h-5 w-5 cursor-pointer accent-rose-500"
          checked={allChecked}
          onChange={onToggleAll}
          disabled={disabled || reportableCount === 0}
          aria-label="신청자 전체선택/해제"
          aria-checked={partial ? 'mixed' : allChecked}
        />
      </label>
      <span className="text-sm font-round font-bold text-slate-700 dark:text-slate-200">
        {selectedCount} / {reportableCount}명 선택됨
      </span>
    </div>
  );
};

const STATUS_BADGE = {
  PENDING: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200',
  APPROVED: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200',
  REJECTED: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200',
};
const STATUS_LABEL = { PENDING: '대기', APPROVED: '확정', REJECTED: '거절' };

const StatusBadge = ({ status }) => {
  if (!status || status === 'APPROVED') return null;
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-display font-bold',
        STATUS_BADGE[status] ?? STATUS_BADGE.PENDING,
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
};

/**
 * 한 신청자 row.
 *
 * @param {{
 *   item: {
 *     id: string; userId: string; status?: string; createdAt: string;
 *     noShow: boolean; noShowCount: number;
 *   };
 *   policy: 'FIRST_COME' | 'APPROVAL';
 *   selected: boolean;
 *   onToggle: () => void;
 *   onApprove: () => void;
 *   onReject: () => void;
 *   disabled: boolean;
 *   deciding: boolean;
 * }} props
 */
const ApplicantRow = ({
  item,
  policy,
  selected,
  onToggle,
  onApprove,
  onReject,
  disabled,
  deciding,
}) => {
  const status = item.status ?? 'APPROVED';
  const isPending = status === 'PENDING';
  const canReport = !item.noShow && status === 'APPROVED';
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-2xl bg-white dark:bg-white/5 ring-1 ring-slate-900/5 dark:ring-white/10 px-4 py-3 shadow-sm',
        (item.noShow || status === 'REJECTED') && 'opacity-70',
      )}
    >
      <label className="inline-flex items-center justify-center h-11 w-11 cursor-pointer">
        <input
          type="checkbox"
          className="h-5 w-5 cursor-pointer accent-rose-500"
          checked={selected}
          onChange={onToggle}
          disabled={disabled || !canReport}
          aria-label={`${item.userId} 선택`}
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className="font-display font-extrabold text-sm text-slate-900 dark:text-white truncate flex items-center gap-2">
          {item.userId}
          <StatusBadge status={status} />
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-round">
          신청 {new Date(item.createdAt).toLocaleString('ko-KR')}
          {item.noShowCount > 0 ? ` · 노쇼 ${item.noShowCount}번 ⚠` : ''}
        </p>
      </div>
      {policy === 'APPROVAL' && isPending ? (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onApprove}
            disabled={deciding}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 text-xs font-display font-bold disabled:opacity-50"
          >
            승인
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={deciding}
            className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-white/15 ring-1 ring-slate-900/10 dark:ring-white/15 text-slate-700 dark:text-slate-100 px-3 py-1 text-xs font-display font-bold disabled:opacity-50"
          >
            거절
          </button>
        </div>
      ) : item.noShow ? (
        <span className="rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-200 px-2 py-0.5 text-[11px] font-display font-bold">
          노쇼
        </span>
      ) : null}
    </li>
  );
};

/**
 * 신청자 리스트.
 *
 * @param {{
 *   items: Array<{
 *     id: string; userId: string; status?: string; createdAt: string;
 *     noShow: boolean; noShowCount: number;
 *   }>;
 *   policy: 'FIRST_COME' | 'APPROVAL';
 *   selected: Set<string>;
 *   onToggle: (uid: string) => void;
 *   onToggleAll: () => void;
 *   onApprove: (appId: string) => void;
 *   onReject: (appId: string) => void;
 *   disabled: boolean;
 *   decidingId: string | null;
 * }} props
 */
export const ApplicantList = ({
  items,
  policy,
  selected,
  onToggle,
  onToggleAll,
  onApprove,
  onReject,
  disabled,
  decidingId,
}) => {
  // 노쇼 신고 대상 = APPROVED + noShow 아님. PENDING/REJECTED 는 제외.
  const reportable = items.filter((a) => !a.noShow && (a.status ?? 'APPROVED') === 'APPROVED');
  return (
    <>
      <SelectAllHeader
        reportableCount={reportable.length}
        selectedCount={selected.size}
        onToggleAll={onToggleAll}
        disabled={disabled}
      />
      <ul id="applicant-list" className="mt-3 flex flex-col gap-2" aria-label="신청자 목록">
        {items.map((a) => (
          <ApplicantRow
            key={a.id}
            item={a}
            policy={policy}
            selected={selected.has(a.userId)}
            onToggle={() => onToggle(a.userId)}
            onApprove={() => onApprove(a.id)}
            onReject={() => onReject(a.id)}
            disabled={disabled}
            deciding={decidingId === a.id}
          />
        ))}
      </ul>
    </>
  );
};
