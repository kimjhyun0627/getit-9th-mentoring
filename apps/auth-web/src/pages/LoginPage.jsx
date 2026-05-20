import { LoginInput } from '@getit/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';

import { FormField } from '../components/FormField.jsx';
import { PasswordField } from '../components/PasswordField.jsx';
import { SubmitButton } from '../components/SubmitButton.jsx';
import { Toast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';
import { redirectAfterAuth } from '../lib/redirect.js';

/**
 * 로그인 페이지 — Tech-Dark + Phase 6c (#255 카피 / #259 토글 / #262 capslock / #272 토스트
 * / #275 16px / #285 컨트라스트 / #287 aria 자연화).
 */
export const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState(/** @type {string|null} */ (null));
  const [toast, setToast] = useState(/** @type {string|null} */ (null));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(LoginInput),
    mode: 'onSubmit',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.login(values);
      setToast('로그인 완료 · 잠시 후 이동합니다');
      setTimeout(() => {
        redirectAfterAuth(searchParams, 'https://get-it.cloud');
      }, 500);
    } catch (err) {
      setServerError(toFriendlyError(err));
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <Toast message={toast} onDone={() => setToast(null)} />
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
          <span className="text-cyan-700 dark:text-cyan-neon">~/auth/login</span>
          <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">
            ·
          </span>
          <span>method: post</span>
          <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">
            ·
          </span>
          <span>
            sso{' '}
            <span data-testid="eyebrow-dot" className="text-lime-700 dark:text-lime-neon">
              ready
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded border border-cyan-700/30 bg-cyan-50 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-700 dark:border-cyan-neon/40 dark:bg-cyan-neon/10 dark:text-cyan-neon">
            [01]
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-700 dark:text-zinc-300">
            LOGIN
          </span>
        </div>
        <h1 className="font-mono text-3xl font-semibold tracking-tightest text-ink-950 dark:text-white">
          GETIT 9기 로그인
          <span
            aria-hidden="true"
            className="caret bg-cyan-700 text-cyan-700 dark:bg-cyan-neon dark:text-cyan-neon"
          />
        </h1>
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          한 계정으로 네 개 프로젝트를 모두 이용하세요
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
        aria-label="GETIT 9기 로그인 폼"
      >
        <FormField
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="비밀번호"
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

      <div className="flex flex-col items-center gap-2 font-mono text-[12px] text-zinc-600 dark:text-zinc-300">
        <p>
          계정이 없으신가요?{' '}
          <Link
            to={`/signup${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
            className="font-semibold text-cyan-700 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none dark:text-cyan-neon"
          >
            회원가입 <span aria-hidden="true">./signup</span>
          </Link>
        </p>
        <p>
          <Link
            to={`/forgot-password${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
            className="text-zinc-600 underline-offset-4 hover:text-cyan-700 hover:underline focus-visible:outline-none dark:text-zinc-300 dark:hover:text-cyan-neon"
          >
            비밀번호 찾기 <span aria-hidden="true">./forgot</span>
          </Link>
        </p>
      </div>
    </div>
  );
};

const toFriendlyError = (err) => {
  const status = err?.response?.status;
  if (status === 401) return '이메일 또는 비밀번호가 올바르지 않습니다';
  if (status === 429) return '잠시 후 다시 시도해주세요';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 발생했습니다 · 잠시 후 다시 시도해주세요';
  return '로그인에 실패했습니다 · 입력을 확인하고 다시 시도해주세요';
};
