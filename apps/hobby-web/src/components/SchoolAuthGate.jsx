/**
 * 학교 인증 라우터 가드 — hobby 페이지 진입 자체 차단 (#562).
 *
 * 정책 (PRD 갱신):
 *  - 로그인 + `schoolVerifiedAt == null` → `<SchoolAuthRequired />` 로 children 대체.
 *  - 비로그인 → children 그대로 통과 (각 페이지가 자체 SSO redirect 처리).
 *  - 학교 인증 완료 → children 그대로 통과.
 *
 * me 캐시는 Header/HomePage 와 동일 키 (`['me']`) — 캐시 공유로 중복 호출 없음.
 *
 * fail-closed 정책 (Gemini security-high #563):
 *  - PM 결정 #562: "외부인이 모집글을 읽는 것 자체"를 차단. flicker 보다 노출 차단 우선.
 *  - me 가 settled 되기 전엔 차단 (로딩 placeholder). settled 후 정책별 분기.
 *  - 비로그인은 settled 후 children 통과 — 각 페이지가 자체 SSO redirect 흐름 처리.
 */
import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api.js';

import { SchoolAuthRequired } from './SchoolAuthRequired.jsx';

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export const SchoolAuthGate = ({ children }) => {
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 60_000,
  });

  const meErrorStatus = meQuery.error?.response?.status;
  const meSettled = !meQuery.isLoading || meQuery.data != null || meErrorStatus === 401;
  const isLoggedIn = Boolean(meQuery.data);
  const isSchoolUnverified = isLoggedIn && !meQuery.data?.schoolVerifiedAt;

  // fail-closed: me 미정인 동안엔 보호 콘텐츠 노출 차단 — 로딩 placeholder 만.
  // settled 후 정책별 분기 (Gemini security-high #563).
  if (!meSettled) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="school-auth-gate-loading"
        className="min-h-screen flex items-center justify-center text-slate-500 dark:text-slate-400 font-round"
      >
        잠시만요…
      </div>
    );
  }
  if (!isLoggedIn) return children;
  if (!isSchoolUnverified) return children;

  return <SchoolAuthRequired />;
};
