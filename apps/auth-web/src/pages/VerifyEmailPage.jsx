import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { SubmitButton } from '../components/SubmitButton.jsx';
import { api } from '../lib/api.js';

/**
 * 이메일 인증 페이지 (Issue #226).
 *
 * 흐름:
 *  - URL `?token=...` 있으면 자동으로 POST /api/verify-email.
 *  - 토큰 없으면 "인증 메일 다시 받기" 버튼만 노출 (로그인 필요).
 */
export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState(/** @type {'idle'|'ok'|'fail'|'pending'} */ ('idle'));
  const [resendState, setResendState] = useState(
    /** @type {'idle'|'ok'|'fail'|'pending'} */ ('idle'),
  );

  useEffect(() => {
    if (!token) return;
    setState('pending');
    api
      .verifyEmail({ token })
      .then(() => setState('ok'))
      .catch(() => setState('fail'));
  }, [token]);

  const onResend = async () => {
    setResendState('pending');
    try {
      await api.resendVerifyEmail();
      setResendState('ok');
    } catch {
      setResendState('fail');
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
          <span className="text-cyan-700 dark:text-cyan-neon">~/auth/verify-email</span>
        </div>
        <h1 className="font-mono text-3xl font-semibold tracking-tightest text-ink-950 dark:text-white">
          이메일 인증
        </h1>
      </header>

      {token ? (
        <Banner state={state} />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            가입 시 보내드린 인증 메일을 받지 못하셨다면 아래 버튼으로 재발송하세요.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onResend();
            }}
            aria-label="인증 메일 재발송 폼"
          >
            <SubmitButton loading={resendState === 'pending'} loadingText="발송 중…">
              인증 메일 다시 받기
            </SubmitButton>
          </form>
          {resendState === 'ok' ? (
            <p role="status" className="font-mono text-[12px] text-cyan-700 dark:text-cyan-neon">
              발송 완료 · 메일함을 확인해주세요
            </p>
          ) : null}
          {resendState === 'fail' ? (
            <p role="alert" className="font-mono text-[12px] text-destructive">
              발송 실패 · 로그인 상태에서만 가능해요
            </p>
          ) : null}
        </div>
      )}

      <div className="divider-mono text-zinc-300 dark:text-zinc-700" aria-hidden="true" />
      <p className="text-center font-mono text-[12px] text-zinc-600 dark:text-zinc-300">
        <Link to="/login" className="hover:text-cyan-700 dark:hover:text-cyan-neon">
          로그인 페이지로
        </Link>
      </p>
    </div>
  );
};

const Banner = ({ state }) => {
  if (state === 'pending')
    return <p className="font-mono text-[12px] text-zinc-500">인증 처리 중…</p>;
  if (state === 'ok')
    return (
      <p
        role="status"
        className="rounded-md border border-cyan-700/30 bg-cyan-50/60 px-4 py-3 font-mono text-[12px] text-cyan-800 dark:border-cyan-neon/30 dark:bg-cyan-neon/5 dark:text-cyan-neon"
      >
        이메일이 인증되었습니다.
      </p>
    );
  if (state === 'fail')
    return (
      <p
        role="alert"
        className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-[12px] text-destructive"
      >
        <span aria-hidden="true">! </span>
        토큰이 만료되었거나 잘못되었습니다 · 인증 메일을 다시 받아주세요
      </p>
    );
  return null;
};
