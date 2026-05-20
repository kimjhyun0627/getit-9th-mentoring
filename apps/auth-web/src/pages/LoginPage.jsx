import { LoginInput } from '@getit/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';

import { FormField } from '../components/FormField.jsx';
import { SubmitButton } from '../components/SubmitButton.jsx';
import { api } from '../lib/api.js';
import { redirectAfterAuth } from '../lib/redirect.js';

/**
 * @typedef {import('@getit/schemas/auth').LoginInputT} LoginInputT
 */

/**
 * 로그인 페이지 — Tech-Dark 페르소나 (Issue #172).
 * - Zod (LoginInput) 검증
 * - POST /api/login (HttpOnly 쿠키 세팅은 auth-api 책임)
 * - 401 → 친절한 한국어 에러
 * - 성공 → ?redirect= 화이트리스트 호스트로 location.replace
 */
export const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState(/** @type {string|null} */ (null));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(LoginInput),
    mode: 'onSubmit',
    defaultValues: { email: '', password: '' },
  });

  /** @param {LoginInputT} values */
  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.login(values);
      redirectAfterAuth(searchParams);
    } catch (err) {
      setServerError(toFriendlyError(err));
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        {/* meta strip — landing hero와 동일 톤 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-500">
          <span className="text-cyan-700 dark:text-cyan-neon">~/auth/login</span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span>method: post</span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span>
            sso{' '}
            <span data-testid="eyebrow-dot" className="text-lime-700 dark:text-lime-neon">
              ready
            </span>
          </span>
        </div>
        {/* 모듈 배지 */}
        <div className="flex items-center gap-2">
          <span className="rounded border border-cyan-700/30 bg-cyan-50 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-neon/40 dark:bg-cyan-neon/10 dark:text-cyan-neon">
            [01]
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            SIGN IN
          </span>
        </div>
        <h1 className="font-mono text-3xl font-semibold tracking-tightest text-ink-950 dark:text-white">
          GETIT 9기 로그인
          <span
            aria-hidden="true"
            className="caret bg-cyan-700 text-cyan-700 dark:bg-cyan-neon dark:text-cyan-neon"
          />
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          한 계정으로 네 개 프로젝트를 모두 이용하세요.
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
        aria-label="로그인 폼"
      >
        <FormField
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
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

        <SubmitButton loading={isSubmitting} loadingText="로그인 중…">
          로그인
        </SubmitButton>
      </form>

      <div className="divider-mono text-zinc-300 dark:text-zinc-700" aria-hidden="true" />

      <p className="text-center font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
        계정이 없으신가요?{' '}
        <Link
          to={`/signup${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
          className="font-semibold text-cyan-700 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none dark:text-cyan-neon"
        >
          회원가입 <span aria-hidden="true">./signup</span>
        </Link>
      </p>
    </div>
  );
};

/**
 * 서버 에러 → 사용자 친화 메시지.
 *
 * @param {unknown} err
 * @returns {string}
 */
const toFriendlyError = (err) => {
  const status = /** @type {{response?: {status?: number}}} */ (err)?.response?.status;
  if (status === 401) return '이메일 또는 비밀번호가 올바르지 않습니다';
  if (status === 429) return '잠시 후 다시 시도해주세요';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요';
  return '로그인에 실패했습니다. 입력을 확인하고 다시 시도해주세요';
};
