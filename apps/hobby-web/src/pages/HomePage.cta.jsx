/**
 * Home 의 "새 모임 만들기" CTA — 학교 인증 여부에 따라 Link / disabled button 분기 (#541).
 *
 * 분리 이유: HomePage 본체가 300줄 cap 안에 들어가도록.
 */
import { Link } from 'react-router-dom';

/**
 * @param {{ disabled: boolean }} props
 *   - `disabled`: 학교 인증 미완료 + 로그인 상태일 때 true. 비로그인은 false 로 처리 (Link 렌더링 → 신청 시 /login redirect 흐름은 별도 가드).
 */
export const NewMeetupCta = ({ disabled }) => {
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="학교 인증한 부원만 가능"
        data-testid="new-meetup-cta-disabled"
        className="group relative inline-flex items-center gap-2 sm:gap-3 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-200 px-5 sm:px-7 py-3 sm:py-4 font-display font-extrabold text-base sm:text-lg shadow-sm cursor-not-allowed self-start whitespace-nowrap"
      >
        <span aria-hidden="true" className="text-xl sm:text-2xl emoji">
          🔒
        </span>
        <span>새 모임 만들기</span>
        <span className="sr-only">— 학교 인증 후 사용 가능</span>
      </button>
    );
  }
  return (
    <Link
      to="/new"
      // #332 — 모바일에서도 한 줄로 (whitespace-nowrap) + 모바일 패딩 축소
      className="group relative inline-flex items-center gap-2 sm:gap-3 rounded-full card-coral text-white px-5 sm:px-7 py-3 sm:py-4 font-display font-extrabold text-base sm:text-lg shadow-xl shadow-rose-400/40 hover:scale-[1.04] hover:-rotate-2 transition self-start whitespace-nowrap"
    >
      <span aria-hidden="true" className="text-xl sm:text-2xl emoji">
        ＋
      </span>
      <span>새 모임 만들기</span>
      <span aria-hidden="true" className="arrow">
        →
      </span>
    </Link>
  );
};
