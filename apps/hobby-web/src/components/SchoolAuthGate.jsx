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
 * flicker 방지 (CR #549 패턴):
 *  - me 가 settled 되기 전엔 children 그대로 (false-positive 차단 위험보다
 *    false-negative 잠깐 노출이 낫다). settled 후 미인증이면 안내 화면.
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

  // me 미정 또는 비로그인 → children 그대로 (각 페이지가 자체 SSO redirect).
  if (!meSettled) return children;
  if (!isLoggedIn) return children;
  if (!isSchoolUnverified) return children;

  return <SchoolAuthRequired />;
};
