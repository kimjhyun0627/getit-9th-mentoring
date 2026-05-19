import { SignupInput } from '@getit/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';

import { FormField } from '../components/FormField.jsx';
import { SubmitButton } from '../components/SubmitButton.jsx';
import { api } from '../lib/api.js';
import { redirectAfterAuth } from '../lib/redirect.js';

/**
 * @typedef {import('@getit/schemas/auth').SignupInputT} SignupInputT
 */

/**
 * 회원가입 페이지.
 * - Zod (SignupInput) 검증 (passwordConfirm refine 포함)
 * - POST /api/signup → auth-api가 자동 로그인까지 처리 (HttpOnly 쿠키)
 * - 409 → 이메일 중복 안내
 * - 성공 → ?redirect= 처리 (LoginPage와 동일)
 */
export const SignupPage = () => {
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState(/** @type {string|null} */ (null));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(SignupInput),
    mode: 'onSubmit',
    defaultValues: { name: '', email: '', password: '', passwordConfirm: '' },
  });

  /** @param {SignupInputT} values */
  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.signup(values);
      redirectAfterAuth(searchParams);
    } catch (err) {
      setServerError(toFriendlyError(err));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-indigo-accent" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sign up
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tightest text-foreground">GETIT 9기 회원가입</h1>
        <p className="text-sm text-muted-foreground">
          멘토링 기간 동안 4개 프로젝트를 한 계정으로.
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
        aria-label="회원가입 폼"
      >
        <FormField
          label="이름"
          autoComplete="name"
          placeholder="홍길동"
          error={errors.name?.message}
          {...register('name')}
        />
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
          autoComplete="new-password"
          placeholder="8자 이상"
          error={errors.password?.message}
          {...register('password')}
        />
        <FormField
          label="비밀번호 확인"
          type="password"
          autoComplete="new-password"
          placeholder="다시 한 번 입력"
          error={errors.passwordConfirm?.message}
          {...register('passwordConfirm')}
        />

        {serverError ? (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <SubmitButton loading={isSubmitting}>회원가입</SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        이미 계정이 있나요?{' '}
        <Link
          to={`/login${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
          className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          로그인
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
  if (status === 409) return '이미 가입된 이메일입니다';
  if (status === 422 || status === 400) return '입력값이 올바르지 않습니다';
  if (status === 429) return '잠시 후 다시 시도해주세요';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요';
  return '회원가입에 실패했습니다. 입력을 확인하고 다시 시도해주세요';
};
