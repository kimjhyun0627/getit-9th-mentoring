import { formatJoinedAt } from '../lib/format-date.js';

/**
 * MeContent — 로그인 사용자의 마이페이지 본문 (school-auth #547).
 *
 * 책임:
 *  - 닉네임 표시 (null/blank → onboarding 진입 카드)
 *  - 가입 일자 (YYYY-MM-DD 한국어 포맷, invalid → '—')
 *  - 학교 인증 상태 (인증/미인증 분기, 학번 노출 + "학교 인증하기" 버튼)
 *
 * 액션:
 *  - 닉네임 설정 → `auth.get-it.cloud/onboarding/nickname?redirect=https://get-it.cloud/me`
 *  - 학교 인증하기 → `auth.get-it.cloud/me?focus=school-link`
 *    (auth-web `/me` 가 focus=school-link 쿼리 받아 학교 연동 카드 자동 스크롤 + 강조)
 *
 * landing 자체 mutation 은 OOS — auth-web 으로 전부 위임. landing 은 상태 확인 + 진입점만.
 *
 * @param {{
 *   user: {
 *     sub: string;
 *     nickname?: string | null;
 *     studentId?: string | null;
 *     schoolVerifiedAt?: string | null;
 *     createdAt?: string;
 *   },
 *   displayName: string,
 * }} props
 * @returns {JSX.Element}
 */
export const MeContent = ({ user, displayName }) => {
  const rawAuthBase = import.meta.env?.VITE_AUTH_ORIGIN || 'https://auth.get-it.cloud';
  const authBase = rawAuthBase.replace(/\/+$/, '');
  // landing /me 자기 자신으로 돌아오는 redirect URL.
  // Gemini (#551): 운영 도메인 hardcode 대신 현재 origin 동적 사용 — 로컬/스테이징 환경
  // 에서도 자기 자신의 /me 로 돌아오게. SSR/JSDOM 안전 (window 가드).
  const landingMeUrl =
    typeof window !== 'undefined' && window.location
      ? `${window.location.origin}/me`
      : 'https://get-it.cloud/me';
  // CR Major (#551): useSession 이 이미 blank 문자열을 null 로 정규화하지만, 외부에서 직접
  // user 를 주입하는 케이스나 BE 응답 schema 변경에 대비해 typeof string 가드 + trim.
  // 비-string (number, object) 도 missing 으로 안전 처리.
  const normalizedNickname = typeof user.nickname === 'string' ? user.nickname.trim() : '';
  const nicknameMissing = normalizedNickname.length === 0;
  const schoolVerified = Boolean(user.schoolVerifiedAt);
  const joinedAt = formatJoinedAt(user.createdAt);
  // CR Minor (#551): studentId 가 '' / 공백 문자열인 경우도 missing 으로 폴백.
  // ?? 만 쓰면 빈 문자열을 그대로 출력해 학번 자리가 비어 보임.
  const normalizedStudentId =
    typeof user.studentId === 'string' && user.studentId.trim().length > 0 ? user.studentId : '—';
  const onboardingUrl = `${authBase}/onboarding/nickname?redirect=${encodeURIComponent(
    landingMeUrl,
  )}`;
  const verifySchoolUrl = `${authBase}/me?focus=school-link`;

  return (
    <div className="grid gap-4">
      {/* 닉네임 카드 */}
      <section
        aria-labelledby="me-nickname-title"
        className="rounded-md border border-hairline bg-white/60 p-6 dark:bg-ink-900/60"
      >
        <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
          nickname
        </p>
        {nicknameMissing ? (
          <div className="mt-2">
            <h2
              id="me-nickname-title"
              className="font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              닉네임을 설정해주세요
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              앞으로 hobby / shelf / board / letter 에서 이 이름이 표시돼요.
            </p>
            <a
              href={onboardingUrl}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-cyan-700 bg-cyan-700 px-4 py-2 font-mono text-xs font-medium text-white transition hover:opacity-90 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-700 dark:border-cyan-neon dark:bg-cyan-neon dark:text-ink-950 dark:focus-visible:outline-cyan-neon"
            >
              <span aria-hidden="true">$</span> 닉네임 설정하기 <span aria-hidden="true">→</span>
            </a>
          </div>
        ) : (
          <h2
            id="me-nickname-title"
            className="mt-2 font-mono text-2xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            <span className="text-zinc-400 dark:text-zinc-500">~/</span>
            {displayName}
          </h2>
        )}
      </section>

      {/* 가입 일자 + 학교 인증 상태 — 가로 2-up (md 이상), 모바일 stack. */}
      <div className="grid gap-4 md:grid-cols-2">
        <section
          aria-labelledby="me-joined-title"
          className="rounded-md border border-hairline bg-white/60 p-6 dark:bg-ink-900/60"
        >
          <p
            id="me-joined-title"
            className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500"
          >
            joined
          </p>
          <p
            data-testid="me-joined-at"
            className="mt-2 font-mono text-base font-medium text-zinc-900 dark:text-zinc-50"
          >
            {joinedAt}
          </p>
        </section>

        <section
          aria-labelledby="me-school-title"
          className="rounded-md border border-hairline bg-white/60 p-6 dark:bg-ink-900/60"
        >
          <p
            id="me-school-title"
            className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500"
          >
            school auth
          </p>
          {schoolVerified ? (
            <p
              data-testid="me-school-status"
              className="mt-2 font-mono text-sm font-medium text-lime-700 dark:text-lime-neon"
            >
              <span aria-hidden="true">✓</span> 학교 인증 완료 · 학번{' '}
              <span className="text-zinc-900 dark:text-zinc-50">{normalizedStudentId}</span>
            </p>
          ) : (
            <div className="mt-2">
              <p
                data-testid="me-school-status"
                className="font-mono text-sm font-medium text-amber-700 dark:text-amber-neon"
              >
                <span aria-hidden="true">!</span> 학교 미인증
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                hobby 모집 / 신청은 학교 인증한 부원만 가능해요.
              </p>
              <a
                href={verifySchoolUrl}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-hairline bg-white/70 px-4 py-2 font-mono text-xs font-medium text-zinc-800 transition hover:border-cyan-700 hover:text-cyan-700 dark:bg-ink-900/70 dark:text-zinc-200 dark:hover:border-cyan-neon dark:hover:text-cyan-neon"
              >
                <span aria-hidden="true">$</span> 학교 인증하기 <span aria-hidden="true">→</span>
              </a>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
