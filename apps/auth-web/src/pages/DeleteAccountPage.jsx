import { DeleteAccountInput } from '@getit/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import { FormField } from '../components/FormField.jsx';
import { PasswordField } from '../components/PasswordField.jsx';
import { SubmitButton } from '../components/SubmitButton.jsx';
import { api } from '../lib/api.js';

/**
 * 회원 탈퇴 페이지 (Issue #231).
 *
 * - currentPassword 재인증 + "탈퇴" 정확 입력 가드.
 * - 성공 시 모든 세션 revoke + 쿠키 clear + landing 으로 이동.
 */
export const DeleteAccountPage = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(/** @type {string|null} */ (null));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(DeleteAccountInput),
    defaultValues: { currentPassword: '', confirm: '' },
  });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.deleteAccount(values);
      window.location.replace('https://get-it.cloud');
    } catch (err) {
      // #423: UserNotFound (이미 탈퇴/세션 만료) → /login redirect.
      const status = err?.response?.status;
      const reason = err?.response?.data?.error;
      if (status === 401 && reason === 'UserNotFound') {
        navigate('/login?redirect=/delete-account', { replace: true });
        return;
      }
      setServerError(toFriendlyError(err));
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-destructive">
          ~/auth/me/danger
        </div>
        <h1 className="font-mono text-3xl font-semibold tracking-tightest text-destructive">
          회원 탈퇴
        </h1>
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          탈퇴하면 아래 처리가 즉시 진행돼요.
        </p>
        {/* #454: 데이터 정책 / cross-domain / 재가입 가능성 명시 (UX writer 라운드). */}
        <ul className="mt-1 list-disc space-y-1 pl-5 font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
          <li>
            계정과 모든 세션이 즉시 종료돼요 — 4 개 프로젝트(취미메이트 · 스마트서재 · 칸반 ·
            롤링페이퍼) 자동 로그아웃
          </li>
          <li>작성한 게시물·댓글·편지는 익명 처리(작성자 표기 제거)되며, 데이터 자체는 유지돼요</li>
          <li>같은 이메일로 다시 가입할 수 있어요 (탈퇴 기록은 보존돼요)</li>
          <li>
            자세한 처리 방식은{' '}
            <a
              href="https://get-it.cloud/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-neon"
            >
              개인정보 처리방침
            </a>
            을 참고해주세요
          </li>
        </ul>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
        aria-label="회원 탈퇴 폼"
      >
        <PasswordField
          label="현재 비밀번호"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <FormField
          label='"탈퇴" 라고 입력'
          placeholder="탈퇴"
          error={errors.confirm?.message}
          {...register('confirm')}
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

        <SubmitButton loading={isSubmitting} loadingText="탈퇴 중…" tone="destructive">
          영구 탈퇴
        </SubmitButton>
      </form>

      <p className="text-center font-mono text-[12px] text-zinc-600 dark:text-zinc-300">
        <Link to="/profile" className="hover:text-cyan-700 dark:hover:text-cyan-neon">
          취소하고 돌아가기
        </Link>
        {' · '}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="hover:text-cyan-700 dark:hover:text-cyan-neon"
        >
          이전 페이지
        </button>
      </p>
    </div>
  );
};

const toFriendlyError = (err) => {
  const status = err?.response?.status;
  if (status === 401) return '현재 비밀번호가 맞지 않습니다';
  if (status === 400) return '"탈퇴" 를 정확히 입력해주세요';
  return '탈퇴에 실패했습니다 · 잠시 후 다시 시도해주세요';
};
