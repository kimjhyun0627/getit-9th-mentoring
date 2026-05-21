import { SignupInput } from '@getit/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';

import { FormField } from '../components/FormField.jsx';
import { PasswordField } from '../components/PasswordField.jsx';
import { PasswordStrength } from '../components/PasswordStrength.jsx';
import { SubmitButton } from '../components/SubmitButton.jsx';
import { Toast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';
import { redirectAfterAuth } from '../lib/redirect.js';

/**
 * 회원가입 페이지 — Tech-Dark 페르소나 + Phase 6c UX (Issue #237 약관 / #259 토글 / #262 capslock
 * / #265 강도 / #272 토스트 / #275 16px / #285 컨트라스트 / #287 aria 자연화 / #255 카피 정리).
 *
 * - SignupInput: 이름/이메일/비번/비번확인 + acceptTerms / acceptPrivacy.
 * - 자동 로그인 + 이메일 인증 토큰 발급 (BE 가 메일 발송 — stub or SMTP).
 */
export const SignupPage = () => {
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState(/** @type {string|null} */ (null));
  const [toast, setToast] = useState(/** @type {string|null} */ (null));

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(SignupInput),
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      passwordConfirm: '',
      acceptTerms: false,
      acceptPrivacy: false,
    },
  });

  const passwordValue = watch('password');

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.signup(values);
      setToast('가입 완료 · 잠시 후 이동합니다');
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
        <MetaStrip />
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="rounded border border-fuchsia-700/30 bg-fuchsia-50 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-fuchsia-700 dark:border-magenta-neon/40 dark:bg-magenta-neon/10 dark:text-magenta-neon"
          >
            [02]
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-700 dark:text-zinc-300">
            SIGN UP
          </span>
        </div>
        <h1 className="font-mono text-3xl font-semibold tracking-tightest text-ink-950 dark:text-white">
          GETIT 9기 회원가입
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
        aria-label="GETIT 9기 회원가입 폼"
      >
        <FormField
          label="이름"
          autoComplete="name"
          placeholder="이름"
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
        <PasswordField
          label="비밀번호"
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

        <Consent register={register} errors={errors} />

        {serverError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-[12px] text-destructive"
          >
            <span aria-hidden="true">! </span>
            {serverError}
          </p>
        ) : null}

        <SubmitButton loading={isSubmitting} loadingText="가입 중…">
          회원가입
        </SubmitButton>
      </form>

      <div className="divider-mono text-zinc-300 dark:text-zinc-700" aria-hidden="true" />

      <p className="text-center font-mono text-[12px] text-zinc-600 dark:text-zinc-300">
        이미 계정이 있으신가요?{' '}
        <Link
          to={`/login${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
          className="font-semibold text-cyan-700 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none dark:text-cyan-neon"
        >
          로그인 <span aria-hidden="true">./login</span>
        </Link>
      </p>
    </div>
  );
};

/**
 * 메타 strip — 컨트라스트 AA 만족시키도록 zinc-700/zinc-300 톤으로 (#285).
 * 카피는 LoginPage 와 평행 (#255).
 */
const MetaStrip = () => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
    <span className="text-cyan-700 dark:text-cyan-neon">~/auth/signup</span>
    <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">
      ·
    </span>
    <span>method: post</span>
    <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">
      ·
    </span>
    <span>
      auto-login <span className="text-lime-700 dark:text-lime-neon">on</span>
    </span>
  </div>
);

/**
 * 약관/개인정보 동의 체크박스 (#237, #470 9기 학습용 컨텍스트 명시).
 *
 * GETIT 은 학회 학습용 임시 서비스 → 약관/처리방침 첫 줄에 9기 운영 기간 한정 명시.
 */
const Consent = ({ register, errors }) => (
  <div className="flex flex-col gap-2 rounded-md border border-hairline bg-white/40 p-3 dark:bg-ink-900/30">
    <p className="font-mono text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
      GETIT 9기 멘토링 학습용 서비스 · 9기 운영 기간에 한해 운영돼요
    </p>
    <label className="flex items-start gap-2 font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
      <input
        type="checkbox"
        {...register('acceptTerms')}
        className="mt-0.5 size-4 rounded border-hairline text-cyan-700 focus:ring-cyan-700/40 dark:text-cyan-neon"
        aria-invalid={Boolean(errors.acceptTerms) || undefined}
      />
      <span>
        <a
          href="https://get-it.cloud/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-neon"
        >
          이용약관
        </a>
        에 동의해요 (필수)
      </span>
    </label>
    {errors.acceptTerms ? (
      <p role="alert" className="font-mono text-[11px] text-destructive">
        <span aria-hidden="true">! </span>
        {errors.acceptTerms.message}
      </p>
    ) : null}
    <label className="flex items-start gap-2 font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
      <input
        type="checkbox"
        {...register('acceptPrivacy')}
        className="mt-0.5 size-4 rounded border-hairline text-cyan-700 focus:ring-cyan-700/40 dark:text-cyan-neon"
        aria-invalid={Boolean(errors.acceptPrivacy) || undefined}
      />
      <span>
        <a
          href="https://get-it.cloud/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-neon"
        >
          개인정보 처리방침
        </a>
        에 동의해요 (필수)
      </span>
    </label>
    {errors.acceptPrivacy ? (
      <p role="alert" className="font-mono text-[11px] text-destructive">
        <span aria-hidden="true">! </span>
        {errors.acceptPrivacy.message}
      </p>
    ) : null}
  </div>
);

const toFriendlyError = (err) => {
  const status = err?.response?.status;
  if (status === 409) return '이미 가입된 이메일입니다';
  if (status === 422 || status === 400) return '입력값이 올바르지 않습니다';
  if (status === 429) return '잠시 후 다시 시도해주세요';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 발생했습니다 · 잠시 후 다시 시도해주세요';
  return '회원가입에 실패했습니다 · 입력을 확인하고 다시 시도해주세요';
};
