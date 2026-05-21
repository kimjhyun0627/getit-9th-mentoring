import { useEffect, useRef } from 'react';

import { cn } from '../lib/cn.js';

/**
 * ApplicantsPage 신청자 리스트 + 전체선택/해제 헤더 — #443/#445.
 *
 * Touch target 44px (Apple HIG): 체크박스 h-11 w-11 (변경 전 h-5 w-5 너무 작았음).
 * 선택 대상은 `!a.noShow` (이미 신고된 신청자는 disabled). select-all 도 동일.
 *
 * 카피 (Playful):
 *  - "노쇼 N번" (변경 전 "누적 노쇼 N회" — 차가운 BE 톤)
 *  - 누적 1회 이상이면 ⚠ 이모지로 가볍게.
 */

/**
 * 전체선택/해제 + 카운트 헤더 — #445.
 *
 * indeterminate state:
 *  - 선택 0 → unchecked.
 *  - 선택 == reportable.length → checked.
 *  - 0 < 선택 < reportable.length → indeterminate (네이티브 brwoser API).
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

/**
 * 신청자 리스트 + 전체선택 헤더.
 *
 * @param {{
 *   items: Array<{
 *     id: string; userId: string; createdAt: string; noShow: boolean; noShowCount: number;
 *   }>;
 *   selected: Set<string>;
 *   onToggle: (uid: string) => void;
 *   onToggleAll: () => void;
 *   disabled: boolean;
 * }} props
 */
export const ApplicantList = ({ items, selected, onToggle, onToggleAll, disabled }) => {
  const reportable = items.filter((a) => !a.noShow);
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
          <li
            key={a.id}
            className={cn(
              'flex items-center gap-3 rounded-2xl bg-white dark:bg-white/5 ring-1 ring-slate-900/5 dark:ring-white/10 px-4 py-3 shadow-sm',
              a.noShow && 'opacity-70',
            )}
          >
            {/* #445 — touch target 44px (label h-11 w-11 클릭 영역 확장). 본디 h-5 w-5 만 있어 모바일 탭 어려움. */}
            <label className="inline-flex items-center justify-center h-11 w-11 cursor-pointer">
              <input
                type="checkbox"
                className="h-5 w-5 cursor-pointer accent-rose-500"
                checked={selected.has(a.userId)}
                onChange={() => onToggle(a.userId)}
                disabled={disabled || a.noShow}
                aria-label={`${a.userId} 선택`}
              />
            </label>
            <div className="min-w-0 flex-1">
              <p className="font-display font-extrabold text-sm text-slate-900 dark:text-white truncate">
                {a.userId}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-round">
                신청 {new Date(a.createdAt).toLocaleString('ko-KR')}
                {a.noShowCount > 0 ? ` · 노쇼 ${a.noShowCount}번 ⚠` : ''}
              </p>
            </div>
            {a.noShow ? (
              <span className="rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-200 px-2 py-0.5 text-[11px] font-display font-bold">
                노쇼
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
};
