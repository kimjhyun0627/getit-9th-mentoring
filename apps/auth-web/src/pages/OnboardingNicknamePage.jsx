import { NicknameValue } from '@getit/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { FormField } from '../components/FormField.jsx';
import { SubmitButton } from '../components/SubmitButton.jsx';
import { api } from '../lib/api.js';

const FormSchema = z.object({ nickname: NicknameValue });

/**
 * `/onboarding/nickname` — 기존 계정 (nickname null) onboarding 강제 페이지.
 *
 * 흐름:
 *   1. /api/me 로드 → 401 이면 /login redirect.
 *   2. user.nickname 이미 있으면 redirect 쿼리로 즉시 이동 (스킵).
 *   3. nickname 입력 → PATCH /api/me/profile → 성공 시 redirect 쿼리로 이동.
 *
 * 6 web 의 NicknameOnboardingGuard 가 이 페이지로 강제 redirect (PR #550).
 * landing 은 자체 /me 에서 onboarding 카드로 처리 (PRD 명시 — 강제 redirect 제외).
 */
export const OnboardingNicknamePage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawRedirect = params.get('redirect');
  const [serverError, setServerError] = useState(/** @type {string|null} */ (null));
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(FormSchema),
    mode: 'onSubmit',
    defaultValues: { nickname: '' },
  });
  const { ref: registerRef, ...registerRest } = register('nickname');

  // 로딩 끝나면 키보드 초기 focus — autoFocus prop a11y 이슈 (모바일 / SR) 회피.
  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  // 진입 시 me 로드 — 비로그인 / 이미 nickname 있음 케이스 처리.
  useEffect(() => {
    api
      .me()
      .then((r) => {
        const u = r.data?.user ?? {};
        if (u.nickname) {
          // 이미 설정된 경우 — onboarding 스킵, 원래 가려던 곳으로.
          window.location.replace(safeBackTarget(rawRedirect));
          return;
        }
        setLoading(false);
      })
      .catch(() => {
        const back = rawRedirect ? `?redirect=${encodeURIComponent(rawRedirect)}` : '';
        navigate(`/login${back}`, { replace: true });
      });
  }, [navigate, rawRedirect]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.updateNickname({ nickname: values.nickname });
      window.location.replace(safeBackTarget(rawRedirect));
    } catch (err) {
      const status = err?.response?.status;
      const reason = err?.response?.data?.error;
      if (status === 409 || reason === 'NicknameTaken') {
        setServerError('이미 사용 중인 닉네임이에요. 다른 닉네임을 골라주세요.');
        return;
      }
      if (status === 401) {
        navigate(`/login${redirectBackToOnboarding(rawRedirect)}`, { replace: true });
        return;
      }
      setServerError('닉네임을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  if (loading) {
    return <p className="font-mono text-[12px] text-zinc-500">불러오는 중…</p>;
  }

  // ref 와 useEffect 로 명시적 focus — autoFocus prop a11y 이슈 회피.
  // (CR: autoFocus 는 모바일 키보드 강제 + screen reader UX 저하)

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
          <span className="text-cyan-700 dark:text-cyan-neon">~/auth/onboarding/nickname</span>
        </div>
        <h1 className="font-mono text-3xl font-semibold tracking-tightest text-ink-950 dark:text-white">
          닉네임 설정
        </h1>
        <p className="text-[13px] text-zinc-700 dark:text-zinc-300">
          GETIT 9기 서비스에서 보일 이름이에요. 한 번 정해두면 다른 부원에게 깔끔하게 표시돼요.
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5"
        aria-label="닉네임 설정"
      >
        <FormField
          label="닉네임"
          id="onboarding-nickname"
          autoComplete="nickname"
          placeholder="예: 길동이"
          error={errors.nickname?.message}
          {...registerRest}
          ref={(el) => {
            registerRef(el);
            inputRef.current = el;
          }}
        />

        {serverError ? (
          <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">
            {serverError}
          </p>
        ) : null}

        <SubmitButton loading={isSubmitting}>저장하고 이어가기</SubmitButton>
      </form>
    </div>
  );
};

/**
 * 401 발생 시 /login 으로 보낼 때 원래 onboarding redirect 를 보존.
 * 사용자가 로그인 후 onboarding 으로 돌아오고, 거기서 nickname 설정 후
 * 다시 rawRedirect (원래 가려던 URL) 로 이어가도록.
 *
 * @param {string | null} rawRedirect
 * @returns {string}
 */
const redirectBackToOnboarding = (rawRedirect) => {
  const onboardingPath = rawRedirect
    ? `/onboarding/nickname?redirect=${encodeURIComponent(rawRedirect)}`
    : '/onboarding/nickname';
  return `?redirect=${encodeURIComponent(onboardingPath)}`;
};

/**
 * `?redirect=` 쿼리를 안전한 GETIT 도메인으로만 허용. 외부 / 다중 레벨 / 비-https 거부.
 * (PRD `?redirect=` 보안 정책과 동일 — 1레벨 *.get-it.cloud 만, lowercase 비교, https 만)
 *
 * @param {string | null} raw
 * @returns {string}
 */
const safeBackTarget = (raw) => {
  const fallback = 'https://get-it.cloud';
  if (!raw) return fallback;
  let parsed;
  try {
    parsed = new URL(raw); // base 인자 없음 — relative URL은 throw.
  } catch {
    return fallback;
  }
  if (parsed.protocol !== 'https:') return fallback;
  const host = parsed.hostname.toLowerCase();
  if (host === 'get-it.cloud') return parsed.toString();
  if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.get-it\.cloud$/.test(host)) return parsed.toString();
  return fallback;
};
