import { displayName as resolveDisplayName } from '@getit/auth-utils';

import { Footer } from '../components/Footer.jsx';
import { Header } from '../components/Header.jsx';
import { useSession } from '../lib/useSession.js';

import { MeContent } from './MeContent.jsx';

/**
 * landing `/me` 마이페이지 (school-auth #547).
 *
 * 디자인: Tech-Dark 페르소나 (landing 전체 톤 통일 — PRD).
 *  - mono eyebrow `[06] /me` (services=[01] / team=[02] / about=[03] / footer=[04] / hero=[05] 다음 슬롯)
 *  - 헤딩 "마이페이지" + 본문 카드들
 *  - 다크모드 우선 + 라이트 대응
 *
 * 상태 분기:
 *  - loading → placeholder skeleton.
 *  - 비로그인 → SignInPanel (shelf RequireSignIn 패턴, Tech-Dark 톤 어댑트).
 *  - 로그인 + nickname null → NicknameOnboardingCard (강제 redirect X — landing 예외).
 *  - 로그인 → MeContent (닉네임, 가입일, 학교 인증 상태).
 *
 * 상위 라우팅은 App.jsx (`window.location.pathname === '/me'`). 본 컴포넌트는 자기
 * 페이지 자체로 Header / Footer 까지 들고 있는 self-contained 페이지.
 *
 * @returns {JSX.Element}
 */
export const MePage = () => {
  const { user, loading } = useSession();
  const displayName = user ? resolveDisplayName(user, user.email || 'me') : '';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-10">
        <header className="mb-10">
          <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-500">
            <span className="text-cyan-700 dark:text-cyan-neon">[06]</span> /me
          </p>
          <h1 className="mt-2 font-mono text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
            마이페이지
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            GETIT 9기 계정 상태 + 학교 인증 진입점.
          </p>
        </header>

        {loading ? (
          <LoadingPanel />
        ) : !user ? (
          <SignInPanel />
        ) : (
          <MeContent user={user} displayName={displayName} />
        )}
      </main>
      <Footer />
    </div>
  );
};

/**
 * 로딩 placeholder — useSession 의 3s 타임아웃 동안 노출. CLS 방지.
 *
 * @returns {JSX.Element}
 */
const LoadingPanel = () => (
  <div data-testid="me-loading" aria-hidden="true" className="grid gap-4">
    <div className="h-24 animate-pulse rounded-md border border-hairline bg-white/40 dark:bg-ink-900/40" />
    <div className="h-24 animate-pulse rounded-md border border-hairline bg-white/40 dark:bg-ink-900/40" />
  </div>
);

/**
 * 비로그인 카드 — shelf RequireSignIn 패턴을 Tech-Dark 톤으로 어댑트.
 *
 * 빌드 타임 fallback: SSR/JSDOM 환경 호환을 위해 `window` 가드.
 * redirect 는 현재 페이지 URL (https://get-it.cloud/me) 로 고정.
 *
 * @returns {JSX.Element}
 */
const SignInPanel = () => {
  // import.meta.env 는 빌드 타임 치환. 끝 슬래시 제거 — `https://auth.get-it.cloud/` 도 안전.
  const rawAuthBase = import.meta.env?.VITE_AUTH_ORIGIN || 'https://auth.get-it.cloud';
  const authBase = rawAuthBase.replace(/\/+$/, '');
  const here = typeof window !== 'undefined' && window.location ? window.location.href : '';
  const loginUrl = here
    ? `${authBase}/login?redirect=${encodeURIComponent(here)}`
    : `${authBase}/login`;

  return (
    <section
      role="status"
      aria-labelledby="signin-card-title"
      className="rounded-md border border-hairline bg-white/60 p-8 text-center dark:bg-ink-900/60"
    >
      <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
        sign in required
      </p>
      <h2
        id="signin-card-title"
        className="mt-2 font-mono text-xl font-semibold text-zinc-900 dark:text-zinc-50"
      >
        로그인이 필요해요
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        마이페이지를 보려면 GETIT 9기 계정으로 로그인해 주세요.
      </p>
      <a
        href={loginUrl}
        className="mt-6 inline-flex items-center gap-1.5 rounded-md border border-cyan-700 bg-cyan-700 px-5 py-2.5 font-mono text-sm font-medium text-white transition hover:opacity-90 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-700 dark:border-cyan-neon dark:bg-cyan-neon dark:text-ink-950 dark:focus-visible:outline-cyan-neon"
      >
        <span aria-hidden="true">$</span> 로그인하러 가기 <span aria-hidden="true">→</span>
      </a>
    </section>
  );
};
