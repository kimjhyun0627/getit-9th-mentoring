/**
 * 학교 인증 필수 안내 화면 — hobby 페이지 진입 자체 차단 (#562).
 *
 * 정책 변경 (PRD 갱신):
 *  - 이전: 조회 OK + mutation 만 차단 (SchoolAuthBanner + disabled 버튼).
 *  - 현재: hobby 사용 자체 학교 인증 필수. 로그인 + `schoolVerifiedAt == null`
 *    이면 모든 hobby 페이지 진입 자체를 막고 이 안내만 노출.
 *
 * 노출 조건 (가드가 결정):
 *  - 로그인 + `schoolVerifiedAt == null` 일 때.
 *  - 비로그인은 기존 SSO redirect 흐름 (다른 페이지가 알아서 처리).
 *  - 학교 인증 완료 → 평소대로 진입 (이 화면 X).
 *
 * 디자인 톤: Playful 페르소나 — SchoolAuthBanner 와 같은 톤 (위협적이지 않게).
 * 카피 (PRD strict):
 *  - 제목: "hobby 서비스는 학교 인증 후 이용할 수 있어요"
 *  - 보조: "학교 메일(@knu.ac.kr) 한 통이면 끝나요. 인증하고 다시 와줘!"
 *  - CTA: "학교 인증하러 가기" → auth.get-it.cloud/me?focus=school-link
 */
import { SCHOOL_AUTH_URL } from '../lib/constants.js';

export const SchoolAuthRequired = () => (
  <div className="relative overflow-hidden min-h-screen">
    <div
      aria-hidden="true"
      className="blob"
      style={{
        width: 380,
        height: 380,
        top: -80,
        left: -60,
        background: 'radial-gradient(circle,#ff8aae 0%,transparent 65%)',
      }}
    />
    <div
      aria-hidden="true"
      className="blob"
      style={{
        width: 320,
        height: 320,
        top: 60,
        right: -40,
        background: 'radial-gradient(circle,#a5b4fc 0%,transparent 65%)',
      }}
    />
    <div aria-hidden="true" className="absolute inset-0 bg-dotted pointer-events-none" />

    <main
      role="main"
      data-testid="school-auth-required"
      className="relative z-10 max-w-2xl mx-auto px-5 lg:px-10 py-20 lg:py-28"
    >
      <div className="rounded-[32px] bg-white/80 dark:bg-white/5 ring-1 ring-slate-900/5 dark:ring-white/10 shadow-xl px-7 sm:px-10 py-12 text-center">
        <p aria-hidden="true" className="text-6xl emoji">
          🎓
        </p>
        <h1 className="mt-5 font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-slate-900 dark:text-white leading-snug">
          hobby 서비스는 학교 인증 후 이용할 수 있어요
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 font-round leading-relaxed">
          학교 메일(@knu.ac.kr) 한 통이면 끝나요. 인증하고 다시 와줘!
        </p>
        <div className="mt-8 flex items-center justify-center">
          <a
            href={SCHOOL_AUTH_URL}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-6 py-3 text-sm sm:text-base font-display font-extrabold shadow-sm hover:scale-[1.03] transition"
          >
            학교 인증하러 가기
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </main>
  </div>
);
