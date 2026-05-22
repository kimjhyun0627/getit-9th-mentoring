import { SchoolLinkInput } from '@getit/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';

import { FormField } from './FormField.jsx';
import { SubmitButton } from './SubmitButton.jsx';

/**
 * 학교 계정 연동 카드 (Issue #539, PRD `.claude/projects/school-auth.md`).
 *
 * 상태 머신:
 *  - `unverified`     : 인증 전 — 학교 메일 입력 폼 + "인증 메일 발송"
 *  - `sent`           : 발송 후 — "메일을 보냈어요" + "재발송" (분당 1건 BE rate limit)
 *  - `verified`       : 인증됨 — schoolEmail + studentId + "학교 인증 다시 받기"
 *
 * `focus` prop = true → 마운트 시 scrollIntoView + 1초 시각 강조 (border ring).
 * landing /me 또는 hobby 안내 카드의 `?focus=school-link` 쿼리 진입점 대응.
 *
 * BE 에러 응답 → FE 메시지:
 *  - 400 InvalidSchoolEmail   → 인라인 "경북대 메일(@knu.ac.kr)만 사용할 수 있어요"
 *  - 409 SchoolEmailTaken     → 인라인 "다른 계정이 이미 인증한 메일이에요. 운영자에게 문의해주세요"
 *  - 429 RateLimitExceeded    → 인라인 "잠시 후 다시 시도해주세요"
 *  - 401                      → 호출자 위임 (세션 만료 처리)
 *
 * @param {{
 *   user: {
 *     schoolEmail: string | null,
 *     studentId: string | null,
 *     schoolVerifiedAt: string | null,
 *   },
 *   focus?: boolean,
 *   onSessionExpired?: () => void,
 * }} props
 */
export const SchoolLinkCard = ({ user, focus = false, onSessionExpired }) => {
  const cardRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [highlight, setHighlight] = useState(false);
  // 인증 완료 상태에서 "다시 인증하기" 누르면 폼으로 돌아간다.
  const [reLink, setReLink] = useState(false);
  const verified = Boolean(user?.schoolVerifiedAt) && !reLink;

  useEffect(() => {
    if (!focus) return;
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlight(true);
    const t = setTimeout(() => setHighlight(false), 1600);
    return () => clearTimeout(t);
  }, [focus]);

  return (
    <section
      ref={cardRef}
      aria-labelledby="school-link-heading"
      data-focus={focus ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-3 rounded-md border border-hairline bg-white/60 p-4 transition dark:bg-ink-900/40',
        highlight &&
          'border-cyan-700 ring-2 ring-cyan-700/30 dark:border-cyan-neon dark:ring-cyan-neon/30',
      )}
    >
      <header className="flex flex-col gap-1">
        <h2
          id="school-link-heading"
          className="font-mono text-sm font-semibold tracking-tight text-ink-950 dark:text-white"
        >
          학교 계정 연동
        </h2>
        <p className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
          경북대 메일(@knu.ac.kr) 한 통으로 학교 인증을 완료할 수 있어요
        </p>
      </header>

      {verified ? (
        <VerifiedState user={user} onReLink={() => setReLink(true)} />
      ) : (
        <UnverifiedFlow onSessionExpired={onSessionExpired} />
      )}
    </section>
  );
};

/**
 * 인증 완료 상태 표시.
 *
 * @param {{
 *   user: { schoolEmail: string | null, studentId: string | null },
 *   onReLink: () => void,
 * }} props
 */
const VerifiedState = ({ user, onReLink }) => (
  <div className="flex flex-col gap-2">
    <p
      role="status"
      className="rounded-md border border-lime-700/30 bg-lime-50/60 px-3 py-2 font-mono text-[12px] text-lime-800 dark:border-lime-neon/30 dark:bg-lime-neon/5 dark:text-lime-neon"
    >
      학교 인증됨{user?.studentId ? ` · 학번 ${user.studentId}` : ''}
    </p>
    {user?.schoolEmail ? (
      <p className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
        학교 메일: {user.schoolEmail}
      </p>
    ) : null}
    <button
      type="button"
      onClick={onReLink}
      className="self-start font-mono text-[12px] text-cyan-700 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none dark:text-cyan-neon"
    >
      학교 인증 다시 받기 <span aria-hidden="true">./re-link</span>
    </button>
  </div>
);

/**
 * 미인증 / 재발송 흐름. 내부 sub-state 로 `idle` → `sent` 전환.
 *
 * @param {{ onSessionExpired?: () => void }} props
 */
const UnverifiedFlow = ({ onSessionExpired }) => {
  // 'idle' = 폼 노출, 'sent' = 발송 완료 안내 + 재발송 버튼
  const [stage, setStage] = useState(/** @type {'idle' | 'sent'} */ ('idle'));
  const [sentEmail, setSentEmail] = useState(/** @type {string | null} */ (null));
  const [serverError, setServerError] = useState(/** @type {string | null} */ (null));
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(SchoolLinkInput),
    mode: 'onSubmit',
    defaultValues: { email: '' },
  });

  const handleApiError = (err) => {
    const status = err?.response?.status;
    const code = err?.response?.data?.error;
    if (status === 401) {
      onSessionExpired?.();
      return true;
    }
    if (status === 400 && code === 'InvalidSchoolEmail') {
      setError('email', {
        type: 'server',
        message: '경북대 메일(@knu.ac.kr)만 사용할 수 있어요',
      });
      return true;
    }
    if (status === 409 && code === 'SchoolEmailTaken') {
      setError('email', {
        type: 'server',
        message: '다른 계정이 이미 인증한 메일이에요. 운영자에게 문의해주세요',
      });
      return true;
    }
    if (status === 429) {
      setServerError('너무 자주 요청했어요 · 잠시 후 다시 시도해주세요');
      return true;
    }
    return false;
  };

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.schoolLink(values);
      setSentEmail(values.email);
      setStage('sent');
    } catch (err) {
      if (!handleApiError(err)) {
        setServerError('인증 메일 발송에 실패했어요 · 잠시 후 다시 시도해주세요');
      }
    }
  };

  const onResend = async () => {
    if (!sentEmail) return;
    setServerError(null);
    setResending(true);
    try {
      await api.schoolLinkResend({ email: sentEmail });
      setServerError(null);
    } catch (err) {
      if (!handleApiError(err)) {
        setServerError('재발송에 실패했어요 · 잠시 후 다시 시도해주세요');
      }
    } finally {
      setResending(false);
    }
  };

  // sent 상태에서 "다른 메일로" 누르면 폼으로 복귀.
  const onChangeEmail = () => {
    setStage('idle');
    setSentEmail(null);
    setServerError(null);
    setValue('email', getValues('email'));
  };

  if (stage === 'sent') {
    return (
      <div className="flex flex-col gap-3">
        <p
          role="status"
          className="rounded-md border border-cyan-700/30 bg-cyan-50/60 px-3 py-2 font-mono text-[12px] text-cyan-800 dark:border-cyan-neon/30 dark:bg-cyan-neon/5 dark:text-cyan-neon"
        >
          {sentEmail} 로 메일을 보냈어요 · 메일함을 확인해주세요
        </p>
        <p className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
          링크는 30분 동안 유효해요. 메일이 안 오면 스팸함도 확인해 보세요.
        </p>
        {serverError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-[12px] text-destructive"
          >
            <span aria-hidden="true">! </span>
            {serverError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            className="font-mono text-[12px] text-cyan-700 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none disabled:opacity-50 dark:text-cyan-neon"
          >
            {resending ? '재발송 중…' : '인증 메일 재발송'}
          </button>
          <button
            type="button"
            onClick={onChangeEmail}
            className="font-mono text-[12px] text-zinc-600 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none dark:text-zinc-300"
          >
            다른 메일로 변경
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-3"
      aria-label="학교 메일 인증 폼"
    >
      <FormField
        label="학교 메일 (@knu.ac.kr)"
        type="email"
        autoComplete="email"
        placeholder="you@knu.ac.kr"
        error={errors.email?.message}
        {...register('email')}
      />
      {serverError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-[12px] text-destructive"
        >
          <span aria-hidden="true">! </span>
          {serverError}
        </p>
      ) : null}
      <SubmitButton loading={isSubmitting} loadingText="발송 중…">
        인증 메일 발송
      </SubmitButton>
    </form>
  );
};
