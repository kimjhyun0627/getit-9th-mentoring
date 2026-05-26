/**
 * 8자리 학번 → 10자리 마이그레이션 blocking 모달 — #573.
 *
 * 정책 (PRD 갱신):
 *  - PR #568 에서 KNU 학번 schema 가 8자리 → 10자리로 정정됐다.
 *  - 기존 8자리 학번 인증자는 BE 가 `studentIdLegacy=true` 로 마킹.
 *  - hobby 진입 시 모달 강제 노출 → 10자리 재입력 → PATCH /api/me/student-id.
 *  - **Dismissible X**: 닫기 버튼 없음, ESC 무효, 배경 클릭 무효.
 *
 * 디자인 톤: hobby-web Playful (SchoolAuthRequired / ConfirmDialog 와 동일 페르소나).
 *  - rounded-3xl + amber accent + cream/slate-900 다크
 *  - blob 배경은 모달 내부 X — backdrop 만 사용 (overlay 시각 거슬리지 않게)
 *
 * a11y:
 *  - role="dialog" + aria-modal=true + aria-labelledby + aria-describedby
 *  - input 자동 포커스 — 키보드 사용자 한 번에 입력 시작
 *  - 에러 메시지는 role="alert" — 스크린리더 즉시 안내
 *  - focus trap: 모달이 blocking 이라 tab/shift+tab 은 input ↔ submit 만 순환
 *
 * 검증:
 *  - 실시간: `/^\d{10}$/` (BE Zod 와 동일)
 *  - input.value 는 onChange 에서 숫자만 필터링 → paste/IME 안전
 *  - maxLength=10 — DOM 강제 제한
 */
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../lib/cn.js';

/** @type {RegExp} */
const STUDENT_ID_REGEX = /^\d{10}$/;

/**
 * 에러 코드/상태별 사용자 안내 메시지 결정.
 *
 * @param {unknown} err - axios error 또는 일반 Error
 * @returns {string}
 */
const messageForError = (err) => {
  const axiosErr = /** @type {{ response?: { status?: number, data?: { error?: string } } }} */ (
    err
  );
  const status = axiosErr?.response?.status;
  const code = axiosErr?.response?.data?.error;
  if (status === 400) return '학번 형식이 올바르지 않아요. 10자리 숫자를 확인해주세요.';
  if (status === 401) return '세션이 만료됐어요. 다시 로그인 후 시도해주세요.';
  if (status === 403 && code === 'SchoolNotVerified') {
    return '학교 인증이 만료됐어요. 학교 인증을 먼저 완료해주세요.';
  }
  if (status === 403) return '권한이 없어요. 새로고침 후 다시 시도해주세요.';
  if (typeof status === 'number' && status >= 500) {
    return '잠시 후 다시 시도해주세요. 일시적인 서버 오류예요.';
  }
  return '저장에 실패했어요. 잠시 후 다시 시도해주세요.';
};

/**
 * @param {{
 *   onSubmit: (body: { studentId: string }) => Promise<void>;
 * }} props
 */
export const StudentIdMigrationModal = ({ onSubmit }) => {
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const inputId = useId();
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const submitRef = useRef(/** @type {HTMLButtonElement | null} */ (null));

  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  // 자동 포커스 — 키보드 사용자 한 번에 입력 시작
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ESC 무효 — blocking 정책. 이벤트 capture + preventDefault 로 다른 핸들러
  // (라우터 등) 가 ESC 를 잡아 모달이 시각적으로만 남는 상황도 차단.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const isValid = STUDENT_ID_REGEX.test(value);
  const showLengthHint = value.length > 0 && !isValid;

  /** @param {React.ChangeEvent<HTMLInputElement>} e */
  const handleChange = (e) => {
    // 숫자만 유지 (paste/IME 안전) + maxLength=10 으로 길이 제한.
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setValue(digits);
    if (error) setError(null);
  };

  /** @param {React.FormEvent<HTMLFormElement>} e */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ studentId: value });
      // 성공 시: 호출자(Gate) 가 me invalidate → studentIdLegacy=false → 언마운트.
      // 여기서 setBusy(false) 하지 않음 — 모달이 사라지므로 불필요.
    } catch (err) {
      setError(messageForError(err));
      setBusy(false);
    }
  };

  // 포커스 트랩 — Tab/Shift+Tab 이 input ↔ submit 만 순환.
  //
  // Gemini #580 (high a11y): submit 이 disabled 일 때 (검증 실패 or busy) HTML
  // 표준상 포커스를 받을 수 없어, Tab 키가 모달 밖으로 탈출한다. 이 경우 강제로
  // input 에 포커스 유지 — blocking 모달의 본질을 깨지 않는다.
  /** @param {React.KeyboardEvent<HTMLDivElement>} e */
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    const input = inputRef.current;
    const submit = submitRef.current;
    if (!input || !submit) return;

    // submit 이 disabled 면 포커스 가능한 요소는 input 뿐 — Tab/Shift+Tab 모두 input 고정.
    if (submit.disabled) {
      e.preventDefault();
      input.focus();
      return;
    }

    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === input) {
        e.preventDefault();
        submit.focus();
      }
    } else if (active === submit) {
      e.preventDefault();
      input.focus();
    }
  };

  // 배경 클릭은 무효 — onClick 핸들러 없음. 위에 dialog 자체가 stopPropagation 없이
  // 그대로 둠. backdrop 만 별도 testid 로 노출 (테스트가 클릭하고 효과 없음을 검증).
  const node = (
    <div
      data-testid="studentid-migration-backdrop"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-[min(28rem,calc(100vw-2rem))]',
          'rounded-3xl border-2 border-dashed border-amber-400/70 dark:border-amber-300/40',
          'bg-amber-50 dark:bg-slate-900',
          'shadow-2xl shadow-rose-200/50 dark:shadow-black/60',
          'p-6 sm:p-7',
          'font-round',
        )}
      >
        <h2
          id={titleId}
          className="font-display font-extrabold text-xl text-slate-900 dark:text-amber-100"
        >
          학번 형식이 변경됐어요
        </h2>
        <p
          id={descriptionId}
          className="mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
        >
          학교에서 사용하는 학번 형식이 10자리로 변경됐어요. 정확한 학번을 입력해주세요.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-5">
          <label
            htmlFor={inputId}
            className="block text-xs font-display font-bold text-slate-600 dark:text-slate-300"
          >
            학번 (10자리)
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            // 10자리 숫자 — BE Zod (`/^\d{10}$/`) 와 동일.
            pattern="\d{10}"
            maxLength={10}
            value={value}
            onChange={handleChange}
            // CR #580 (minor): busy 중에도 input 은 readOnly 로만 잠그고 focus 는
            // 받을 수 있게 둔다. disabled 면 input/submit 둘 다 disabled 가 되어
            // focus trap 의 `input.focus()` 가 실패 → Tab 탈출 여지. readOnly 는
            // 값 수정만 막고 포커스는 유지 — blocking 모달 본질 보존.
            readOnly={busy}
            aria-invalid={showLengthHint ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            placeholder="2024111234"
            className={cn(
              'mt-1 w-full rounded-2xl bg-white dark:bg-white/10',
              'ring-1 ring-slate-900/10 dark:ring-white/15',
              'px-4 py-3 text-base text-slate-900 dark:text-amber-50',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
              'disabled:opacity-50',
              'tracking-widest',
            )}
          />
          {showLengthHint ? (
            <p className="mt-2 text-xs text-rose-600 dark:text-rose-300 font-round">
              학번은 10자리 숫자예요. ({value.length}/10)
            </p>
          ) : null}

          {error ? (
            <p
              id={errorId}
              role="alert"
              className="mt-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 ring-1 ring-rose-300/60 dark:ring-rose-400/30 px-3 py-2 text-sm text-rose-700 dark:text-rose-200 font-round"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex items-center justify-end">
            <button
              ref={submitRef}
              type="submit"
              disabled={!isValid || busy}
              className={cn(
                'inline-flex items-center gap-1 rounded-full text-white px-5 py-2 text-sm',
                'font-display font-bold shadow',
                'bg-amber-500 hover:bg-amber-600',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50 dark:focus-visible:ring-offset-slate-900',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
};
