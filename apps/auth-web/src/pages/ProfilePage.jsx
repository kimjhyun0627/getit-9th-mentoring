import { UpdateProfileInput } from '@getit/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import { FormField } from '../components/FormField.jsx';
import { PasswordField } from '../components/PasswordField.jsx';
import { PasswordStrength } from '../components/PasswordStrength.jsx';
import { SubmitButton } from '../components/SubmitButton.jsx';
import { Toast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';

/**
 * 프로필 수정 페이지 (Issue #235).
 *
 * - 진입 시 /api/me 로드.
 * - 이름/이메일/비밀번호 변경. currentPassword 재인증 필수.
 * - 비밀번호 변경 시 새 토큰이 발급되므로 현재 세션은 유지 (BE 가 처리).
 * - 이메일 변경 시 emailVerifiedAt 초기화 → 새 인증 메일 발송 안내.
 */
export const ProfilePage = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(/** @type {string|null} */ (null));
  const [toast, setToast] = useState(/** @type {string|null} */ (null));
  const [me, setMe] = useState(
    /** @type {null | {email:string,name:string,emailVerifiedAt:string|null}} */ (null),
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(UpdateProfileInput),
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      email: '',
      currentPassword: '',
      newPassword: '',
      newPasswordConfirm: '',
    },
  });

  useEffect(() => {
    api
      .me()
      .then((r) => {
        const u = r.data?.user ?? {};
        setMe(u);
        reset({
          name: u.name ?? '',
          email: u.email ?? '',
          currentPassword: '',
          newPassword: '',
          newPasswordConfirm: '',
        });
      })
      .catch(() => navigate('/login?redirect=/profile', { replace: true }));
  }, [navigate, reset]);

  const newPassword = watch('newPassword');

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      const payload = { ...values };
      if (!payload.newPassword) {
        delete payload.newPassword;
        delete payload.newPasswordConfirm;
      }
      await api.updateProfile(payload);
      setToast('프로필이 저장되었습니다');
    } catch (err) {
      setServerError(toFriendlyError(err));
    }
  };

  if (!me) return <p className="font-mono text-[12px] text-zinc-500">불러오는 중…</p>;

  return (
    <div className="flex flex-col gap-7">
      <Toast message={toast} onDone={() => setToast(null)} />
      <header className="flex flex-col gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
          <span className="text-cyan-700 dark:text-cyan-neon">~/auth/me/profile</span>
        </div>
        <h1 className="font-mono text-3xl font-semibold tracking-tightest text-ink-950 dark:text-white">
          프로필 수정
        </h1>
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          이름 · 이메일 · 비밀번호를 변경할 수 있어요
        </p>
        {!me.emailVerifiedAt ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-50/60 px-3 py-2 font-mono text-[11px] text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/5 dark:text-amber-300">
            이메일이 아직 인증되지 않았습니다.{' '}
            <Link to="/verify-email" className="underline">
              인증 메일 다시 받기
            </Link>
          </p>
        ) : null}
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
        aria-label="프로필 수정 폼"
      >
        <FormField label="이름" error={errors.name?.message} {...register('name')} />
        <FormField
          label="이메일"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="현재 비밀번호 (확인)"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordField
          label="새 비밀번호 (선택)"
          autoComplete="new-password"
          placeholder="비워두면 변경 안 함"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        {newPassword ? <PasswordStrength value={newPassword} /> : null}
        <PasswordField
          label="새 비밀번호 확인"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.newPasswordConfirm?.message}
          {...register('newPasswordConfirm')}
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

        <SubmitButton loading={isSubmitting} loadingText="저장 중…">
          저장
        </SubmitButton>
      </form>

      <div className="divider-mono text-zinc-300 dark:text-zinc-700" aria-hidden="true" />

      <div className="flex flex-col gap-2 font-mono text-[12px] text-zinc-600 dark:text-zinc-300">
        <Link to="/sessions" className="hover:text-cyan-700 dark:hover:text-cyan-neon">
          활성 세션 관리 <span aria-hidden="true">./sessions</span>
        </Link>
        <Link to="/delete-account" className="text-destructive hover:underline">
          회원 탈퇴 <span aria-hidden="true">./danger</span>
        </Link>
      </div>
    </div>
  );
};

const toFriendlyError = (err) => {
  const status = err?.response?.status;
  if (status === 401) return '현재 비밀번호가 맞지 않습니다';
  if (status === 409) return '이미 사용 중인 이메일입니다';
  if (status === 400) return '입력값이 올바르지 않습니다';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 발생했습니다 · 잠시 후 다시 시도해주세요';
  return '저장에 실패했습니다 · 잠시 후 다시 시도해주세요';
};
