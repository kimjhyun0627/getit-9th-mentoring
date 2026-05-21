import { useEffect, useState } from 'react';

const STORAGE_KEY = 'onboarded';

/**
 * 첫 사용자 온보딩 챗봇 (#361, #418).
 *
 * - Tech-Dark coder 톤: `>` prompt prefix, mono 폰트
 * - 데스크탑 (md+): 우상단 토글 옆 `top-20 right-4` + hint arrow 로 토글 위치 안내
 * - 모바일 (md 미만, #418): 하단 floating `bottom-4 inset-x-4` — sticky 헤더 sign-in 가림 회피
 *   + hint arrow 는 모바일에서 hidden (가리킬 토글이 멀어 의미 없음 + 자기 가리킴 회피)
 * - localStorage 'onboarded'='true' 면 미렌더 (한 번만)
 * - '이해했어요' 클릭 시 dismiss + localStorage 저장
 *
 * mount 후 마이크로 지연으로 layout/CLS 안정 후 등장.
 */
export const OnboardingBubble = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const onboarded = window.localStorage.getItem(STORAGE_KEY);
      if (onboarded === 'true') return;
    } catch {
      // localStorage 접근 실패 시 (private mode 등) → 표시는 하되 저장 X
    }
    setVisible(true);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // 저장 실패해도 dismiss 는 진행
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="onboarding-bubble-title"
      data-testid="onboarding-bubble"
      className="fixed inset-x-4 bottom-4 z-40 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-cyan-700 bg-white/95 p-4 font-mono text-[12px] leading-relaxed text-zinc-700 shadow-lg backdrop-blur md:inset-x-auto md:bottom-auto md:right-4 md:top-20 md:w-[min(20rem,calc(100vw-2rem))] dark:border-cyan-neon dark:bg-ink-900/95 dark:text-zinc-200 dark:shadow-[0_0_0_1px_rgba(34,211,238,0.4),0_0_28px_-4px_rgba(34,211,238,0.55)]"
    >
      <div
        aria-hidden="true"
        data-testid="onboarding-hint-arrow"
        className="absolute -top-2 right-10 hidden h-2 w-2 rotate-45 border-l border-t border-cyan-700 bg-white/95 md:block dark:border-cyan-neon dark:bg-ink-900/95"
      />
      <p
        id="onboarding-bubble-title"
        className="mb-2 text-[10px] uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-neon"
      >
        <span aria-hidden="true">$</span> welcome.sh
      </p>
      <p className="mb-3">
        <span aria-hidden="true" className="text-cyan-700 dark:text-cyan-neon">
          &gt;{' '}
        </span>
        안녕! 처음이지? 다크/라이트 토글은 우상단에 있어. 한 번 눌러봐{' '}
        <span aria-hidden="true">:)</span>
      </p>
      <button
        type="button"
        onClick={dismiss}
        data-testid="onboarding-dismiss"
        className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-ink-950 px-3 py-1.5 font-mono text-[11px] font-semibold text-cyan-neon transition hover:brightness-110 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 dark:bg-cyan-neon dark:text-ink-950 dark:focus-visible:outline-cyan-neon"
      >
        <span aria-hidden="true">$</span> 이해했어요
      </button>
    </div>
  );
};
