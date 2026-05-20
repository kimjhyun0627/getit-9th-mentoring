import { useId, useState } from 'react';

import { cn } from '../lib/cn.js';

const MAX_TAGS = 5;
const MAX_TAG_LEN = 24;

/**
 * 칩 기반 태그 입력 — 최대 5개, 각 1~24자.
 *
 * Enter / `,` / Space 로 현재 입력값을 chip 으로 commit.
 * RHF 와 `Controller` 없이 통합하려고 controlled (value/onChange) 로 노출.
 *
 * @typedef {object} TagInputProps
 * @property {string[]} value 현재 태그 리스트
 * @property {(next: string[]) => void} onChange 변경 콜백
 * @property {string} [label] 시각적 라벨 텍스트 (default "태그")
 * @property {string} [hint] 보조 설명 (input 아래)
 * @property {string} [error] 검증 에러 메시지 (있으면 destructive 스타일)
 * @property {string} [placeholder] 빈 입력일 때 placeholder
 */

/** @param {TagInputProps} props */
export const TagInput = ({
  value,
  onChange,
  label = '태그',
  hint = `Enter 로 추가 · 최대 ${MAX_TAGS}개 · 문자·숫자·하이픈(-)·언더스코어(_)`,
  error,
  placeholder = '예: 마라탕, 북문, 스터디',
}) => {
  const [draft, setDraft] = useState('');
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  /** 현재 draft 를 정규화하고 chip 으로 추가. 중복/제한 체크. */
  const commit = () => {
    const next = draft.trim();
    if (!next) return;
    if (value.length >= MAX_TAGS) {
      setDraft('');
      return;
    }
    const lower = next.toLowerCase();
    if (value.some((t) => t.toLowerCase() === lower)) {
      setDraft('');
      return;
    }
    onChange([...value, next.slice(0, MAX_TAG_LEN)]);
    setDraft('');
  };

  /** @param {import('react').KeyboardEvent<HTMLInputElement>} e */
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      // 빈 input 에서 Backspace → 마지막 칩 제거.
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  /** @param {number} idx */
  const removeAt = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-round text-sm font-bold text-slate-800 dark:text-slate-100"
      >
        {label}
      </label>

      <div
        className={cn(
          'flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition [color-scheme:light]',
          'focus-within:ring-2 focus-within:ring-rose-400 focus-within:ring-offset-2 focus-within:ring-offset-background',
          'dark:border-white/10 dark:bg-zinc-900/60 dark:shadow-inner dark:shadow-black/30 dark:[color-scheme:dark] dark:focus-within:ring-amber-300',
          error && 'border-rose-500 focus-within:ring-rose-500 dark:border-rose-400',
        )}
      >
        {value.map((tag, idx) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 font-round text-[12px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
          >
            #{tag}
            <button
              type="button"
              aria-label={`태그 ${tag} 제거`}
              onClick={() => removeAt(idx)}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-200 text-[10px] font-bold text-rose-700 transition hover:bg-rose-300 dark:bg-rose-500/30 dark:text-rose-100"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          maxLength={MAX_TAG_LEN}
          placeholder={value.length === 0 ? placeholder : ''}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className="min-w-[8rem] flex-1 bg-transparent px-2 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-rose-600 dark:text-rose-300"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
};
