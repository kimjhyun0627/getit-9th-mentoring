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
 * 로그인 페이지.
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span
            data-testid="eyebrow-dot"
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-indigo-accent"
          />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            SSO Login
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tightest text-foreground">GETIT 9기 로그인</h1>
        <p className="text-sm text-muted-foreground">한 번 로그인으로 네 개 프로젝트 모두 사용.</p>
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
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <SubmitButton loading={isSubmitting}>로그인</SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        아직 계정이 없나요?{' '}
        <Link
          to={`/signup${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
          className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          회원가입
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
  /** @type {any} */
  const e = err;
  const status = e?.response?.status;
  if (status === 401) return '이메일 또는 비밀번호가 올바르지 않습니다';
  if (status === 429) return '잠시 후 다시 시도해주세요';
  if (status >= 500) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요';
  return '로그인에 실패했습니다. 입력을 확인하고 다시 시도해주세요';
};
