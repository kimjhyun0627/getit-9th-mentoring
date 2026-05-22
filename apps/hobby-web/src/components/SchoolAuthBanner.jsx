/**
 * 학교 인증 안내 배너 — hobby home (#541).
 *
 * 노출 조건 (호출자가 결정):
 *  - 로그인 + `schoolVerifiedAt == null` 일 때만 렌더.
 *  - 비로그인은 기존 RequireSignIn 패턴 그대로 — 이 컴포넌트는 모름.
 *
 * 디자인 톤: Playful 페르소나 — 위협적이지 않게, 반말 OK.
 *
 * 카피 (PRD strict — 변경 금지):
 *  - 제목: "hobby 서비스를 사용하려면 학교 인증이 필요해요"
 *  - 보조: "모집글 작성 / 신청은 학교 인증한 부원만 가능해요. 학교 메일(@knu.ac.kr) 한 통이면 끝나요."
 *  - CTA: "학교 인증하러 가기" → auth.get-it.cloud/me?focus=school-link
 *
 * dismiss:
 *  - PRD 결정: 세션 내 dismiss 만 (localStorage 영구 dismiss 금지 — 행동 유도가 목적).
 *  - 부모 컴포넌트가 useState 로 dismissed 상태 관리, 다음 마운트 시 다시 보임.
 */
import { SCHOOL_AUTH_URL } from '../lib/constants.js';

/**
 * @param {{ onDismiss?: () => void }} props
 */
export const SchoolAuthBanner = ({ onDismiss }) => (
  <div
    role="status"
    aria-live="polite"
    data-testid="school-auth-banner"
    className="relative mb-8 rounded-3xl bg-gradient-to-r from-amber-100 via-rose-100 to-fuchsia-100 dark:from-amber-500/15 dark:via-rose-500/15 dark:to-fuchsia-500/15 ring-1 ring-rose-200/60 dark:ring-rose-400/20 shadow-sm px-5 sm:px-7 py-5 sm:py-6"
  >
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
      <div className="flex items-start gap-3 sm:gap-4 flex-1">
        <span aria-hidden="true" className="text-3xl sm:text-4xl shrink-0 emoji">
          🎓
        </span>
        <div className="min-w-0">
          <p className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-snug">
            hobby 서비스를 사용하려면 학교 인증이 필요해요
          </p>
          <p className="mt-1 text-sm font-round text-slate-700 dark:text-slate-200 leading-relaxed">
            모집글 작성 / 신청은 학교 인증한 부원만 가능해요. 학교 메일(@knu.ac.kr) 한 통이면
            끝나요.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:shrink-0">
        <a
          href={SCHOOL_AUTH_URL}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-5 py-2.5 text-sm font-display font-extrabold shadow-sm whitespace-nowrap hover:scale-[1.03] transition"
        >
          학교 인증하러 가기
          <span aria-hidden="true">→</span>
        </a>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="안내 닫기"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/70 dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/20 transition"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>
    </div>
  </div>
);
