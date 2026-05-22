import { VerifySchoolInput } from '@getit/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { FormField } from '../components/FormField.jsx';
import { SubmitButton } from '../components/SubmitButton.jsx';
import { Toast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';

/**
 * 학교 메일 인증 확정 페이지 (Issue #539, PRD `.claude/projects/school-auth.md`).
 *
 * 흐름:
 *  - URL `?token=...` 받음. 토큰이 없거나 너무 짧으면 즉시 안내.
 *  - 학번 10자리 입력 폼 노출 → 제출 시 POST /api/auth/verify-school.
 *  - 응답 처리:
 *    - 200: "학교 인증 완료" 토스트 → /me redirect
 *    - 400 InvalidToken: 토큰 만료/사용/없음 안내 + 마이페이지 링크 (재발송 유도)
 *    - 400 ValidationError (studentId path): 학번 인라인 에러
 *    - 409 SchoolEmailTaken: 운영자 문의 안내
 *    - 그 외: 일반 실패 메시지
 */
export const VerifySchoolPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  // BE 의 token 길이 기준 (32+) 과 동일. 형식만 사전 차단 (BE 호출 X).
  const tokenLooksValid = token.length >= 32;

  const [toast, setToast] = useState(/** @type {string | null} */ (null));
  const [serverError, setServerError] = useState(/** @type {string | null} */ (null));
  const [tokenError, setTokenError] = useState(!tokenLooksValid);
  const [conflict, setConflict] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(VerifySchoolInput),
    mode: 'onSubmit',
    defaultValues: { token, studentId: '' },
  });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.verifySchool(values);
      setToast('학교 인증 완료 · 잠시 후 이동합니다');
      setTimeout(() => {
        navigate('/me', { replace: true });
      }, 600);
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.error;
      if (status === 400 && code === 'InvalidToken') {
        setTokenError(true);
        return;
      }
      if (status === 400) {
        // BE ValidationError (zodErrorBody) → studentId 인라인 매핑.
        setError('studentId', {
          type: 'server',
          // schema 메시지와 통일 — 사용자에게 일관된 피드백 (Gemini #568).
          message: '학번은 10자리 숫자입니다',
        });
        return;
      }
      if (status === 409 && code === 'SchoolEmailTaken') {
        setConflict(true);
        return;
      }
      setServerError('학교 인증에 실패했어요 · 잠시 후 다시 시도해주세요');
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <Toast message={toast} onDone={() => setToast(null)} />
      <header className="flex flex-col gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
          <span className="text-cyan-700 dark:text-cyan-neon">~/auth/verify-school</span>
        </div>
        <h1 className="font-mono text-3xl font-semibold tracking-tightest text-ink-950 dark:text-white">
          학교 인증
        </h1>
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          학번 10자리를 입력하면 학교 인증이 완료돼요
        </p>
      </header>

      {tokenError ? (
        <TokenInvalidNotice />
      ) : conflict ? (
        <ConflictNotice />
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
          aria-label="학번 입력 폼"
        >
          <input type="hidden" {...register('token')} />
          <FormField
            label="학번 (10자리)"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            // Gemini #568: paste 시 앞뒤 공백 잘림 방지 — schema 가 trim 처리.
            maxLength={12}
            placeholder="2024111234"
            error={errors.studentId?.message}
            {...register('studentId')}
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
          <SubmitButton loading={isSubmitting} loadingText="인증 중…">
            학교 인증 완료
          </SubmitButton>
        </form>
      )}

      <div className="divider-mono text-zinc-300 dark:text-zinc-700" aria-hidden="true" />
      <p className="text-center font-mono text-[12px] text-zinc-600 dark:text-zinc-300">
        <Link to="/me" className="hover:text-cyan-700 dark:hover:text-cyan-neon">
          마이페이지로
        </Link>
      </p>
    </div>
  );
};

const TokenInvalidNotice = () => (
  <div className="flex flex-col gap-3">
    <p
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-[12px] text-destructive"
    >
      <span aria-hidden="true">! </span>
      인증 링크가 만료됐거나 이미 사용된 토큰이에요
    </p>
    <p className="font-mono text-[12px] text-zinc-600 dark:text-zinc-300">
      마이페이지에서 인증 메일을 다시 받아주세요.
    </p>
    <Link
      to="/me?focus=school-link"
      className="self-start font-mono text-[12px] text-cyan-700 underline-offset-4 hover:underline focus-visible:underline dark:text-cyan-neon"
    >
      마이페이지로 가서 다시 받기 <span aria-hidden="true">./me</span>
    </Link>
  </div>
);

const ConflictNotice = () => (
  <div className="flex flex-col gap-3">
    <p
      role="alert"
      className="rounded-md border border-amber-500/40 bg-amber-50/60 px-3 py-2 font-mono text-[12px] text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/5 dark:text-amber-300"
    >
      <span aria-hidden="true">! </span>
      다른 계정이 이미 인증한 학교 메일이에요
    </p>
    <p className="font-mono text-[12px] text-zinc-600 dark:text-zinc-300">
      본인 계정이 맞다면 운영자에게 문의해주세요.
    </p>
  </div>
);
