/**
 * RequireSignIn — shelf-web 비로그인(401) 빈 상태 카드.
 *
 * 디자인 (Editorial / Warm 톤, shelf 디자인 시스템 일관):
 *  - smallcaps eyebrow + font-display 헤드라인 + essay-kr 부제 + primary 버튼
 *  - 빨간 텍스트 한 줄로만 보여주던 #531 이전 대비 명확한 액션 제시
 *
 * SSR 안전: `typeof window === 'undefined'` 시 redirect 빈 문자열. shelf-web 은 CSR 전용이라
 * 실제로 SSR 환경은 없지만 테스트 mock + 안전성 차원에서 guard.
 *
 * @returns {JSX.Element}
 */
export const RequireSignIn = () => {
  // import.meta.env 는 빌드 타임에 치환됨. 빈 문자열도 미설정으로 간주 → ||  연산자.
  const authBase = import.meta.env?.VITE_AUTH_URL || 'https://auth.get-it.cloud';
  const here = typeof window === 'undefined' ? '' : window.location.href;
  const loginUrl = `${authBase}/login?redirect=${encodeURIComponent(here)}`;

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="로그인이 필요합니다"
      className="border-t border-b themed-border mx-auto flex flex-col items-center py-16 text-center"
      style={{ borderColor: 'var(--rule-1)' }}
    >
      <p className="smallcaps mb-3 text-[11px]">Sign in required</p>
      <h3 className="font-display tracking-hero text-2xl font-black leading-[1.1] md:text-3xl">
        로그인이 필요해요<span className="text-wine">.</span>
      </h3>
      <p className="essay-kr text-body mx-auto mt-3 max-w-[36ch] text-[14px] leading-relaxed">
        서가를 펼치려면 GET IT 계정으로 로그인해 주세요.
      </p>
      <a
        href={loginUrl}
        className="mt-7 inline-flex items-center gap-2 rounded-sm border border-foreground bg-foreground px-6 py-3 font-display text-[14px] font-bold text-background transition hover:opacity-90"
      >
        로그인하러 가기 <span aria-hidden="true">→</span>
      </a>
    </section>
  );
};
