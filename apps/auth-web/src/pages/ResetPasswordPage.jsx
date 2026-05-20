import { ResetPasswordInput } from '@getit/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';

import { PasswordField } from '../components/PasswordField.jsx';
import { PasswordStrength } from '../components/PasswordStrength.jsx';
import { SubmitButton } from '../components/SubmitButton.jsx';
import { api } from '../lib/api.js';

/**
 * @typedef {import('@getit/schemas/auth').ResetPasswordInputT} ResetPasswordInputT
 */

/**
 * 비밀번호 재설정 확정 페이지 (Issue #221).
 * - URL `?token=...` 에서 1회용 토큰 추출 (hidden field 로 form 에 주입)
 * - Zod (ResetPasswordInput) 검증 (token + password + passwordConfirm refine)
 * - POST /api/password/reset
 * - 성공 → "/login" 으로 안내 (자동 로그인은 X — 사용자가 명시적으로 로그인)
 * - 400 → 토큰 만료/사용/잘못 입력 안내
 */
export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState(/** @type {string|null} */ (null));

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(ResetPasswordInput),
    mode: 'onSubmit',
    defaultValues: { token: tokenFromUrl, password: '', passwordConfirm: '' },
  });
  const passwordValue = watch('password');

  /** @param {ResetPasswordInputT} values */
  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.resetPassword(values);
      setDone(true);
    } catch (err) {
      setServerError(toFriendlyError(err));
    }
  };

  if (done) {
    return (
      <div className="flex flex-col gap-6" data-testid="reset-success">
        <Header />
        <p
          role="status"
          className="rounded-md border border-cyan-700/30 bg-cyan-50/60 px-4 py-3 font-mono text-[12px] text-cyan-800 dark:border-cyan-neon/30 dark:bg-cyan-neon/5 dark:text-cyan-neon"
        >
          비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.
        </p>
        <Link
          to="/login"
          className="text-center font-mono text-[12px] text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-neon"
        >
          로그인 페이지로 이동 <span aria-hidden="true">./login</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <Header />

      {!tokenFromUrl ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-[12px] text-destructive"
        >
          <span aria-hidden="true">! </span>
          토큰이 없습니다 · 비밀번호 찾기를 다시 시도해주세요
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
        aria-label="비밀번호 재설정 양식"
      >
        {/* token 은 hidden — 사용자 입력 X. URL ?token= 으로만 채워짐. */}
        <input type="hidden" {...register('token')} />
        <PasswordField
          label="새 비밀번호"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordStrength value={passwordValue} />
        <PasswordField
          label="비밀번호 확인"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.passwordConfirm?.message}
          {...register('passwordConfirm')}
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

        <SubmitButton loading={isSubmitting} loadingText="변경 중…">
          비밀번호 변경
        </SubmitButton>
      </form>

      <div className="divider-mono text-zinc-300 dark:text-zinc-700" aria-hidden="true" />

      <p className="text-center font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
        토큰이 만료됐나요?{' '}
        <Link
          to="/forgot-password"
          className="font-semibold text-cyan-700 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none dark:text-cyan-neon"
        >
          다시 요청 <span aria-hidden="true">./forgot</span>
        </Link>
      </p>
    </div>
  );
};

const Header = () => (
  <header className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-500">
      <span className="text-cyan-700 dark:text-cyan-neon">~/auth/reset</span>
      <span className="text-zinc-300 dark:text-zinc-700">·</span>
      <span>method: post</span>
      <span className="text-zinc-300 dark:text-zinc-700">·</span>
      <span>
        one-shot <span className="text-lime-700 dark:text-lime-neon">token</span>
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span className="rounded border border-fuchsia-700/30 bg-fuchsia-50 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-fuchsia-700 dark:border-magenta-neon/40 dark:bg-magenta-neon/10 dark:text-magenta-neon">
        [04]
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        RESET
      </span>
    </div>
    <h1 className="font-mono text-3xl font-semibold tracking-tightest text-ink-950 dark:text-white">
      비밀번호 재설정
      <span
        aria-hidden="true"
        className="caret bg-cyan-700 text-cyan-700 dark:bg-cyan-neon dark:text-cyan-neon"
      />
    </h1>
    <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
      새 비밀번호를 설정해주세요
    </p>
  </header>
);

/**
 * 서버 에러 → 사용자 친화 메시지.
 *
 * @param {unknown} err
 * @returns {string}
 */
const toFriendlyError = (err) => {
  const status = /** @type {{response?: {status?: number}}} */ (err)?.response?.status;
  if (status === 400)
    return '토큰이 만료되었거나 이미 사용되었습니다 · 비밀번호 찾기를 다시 시도해주세요';
  if (status === 429) return '잠시 후 다시 시도해주세요';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 발생했습니다 · 잠시 후 다시 시도해주세요';
  return '요청에 실패했습니다 · 잠시 후 다시 시도해주세요';
};
