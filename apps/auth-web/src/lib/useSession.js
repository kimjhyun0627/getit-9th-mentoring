/**
 * useSession — 마운트 시 GET /api/me 핑으로 현재 SSO 세션 상태 확인 (Issue #295,
 * school-auth #540 확장).
 *
 * 반환:
 *   - status: 'loading' | 'authenticated' | 'unauthenticated'
 *   - user:   SessionUser | null
 *
 * /api/me 는 우리 axios 인스턴스의 401 콜백을 트리거할 수 있으므로,
 * 이 훅을 호출하는 페이지에선 콜백을 등록하지 않거나 no-op 로 두는 게 안전하다.
 *
 * school-auth (#540): user 객체에 nickname / studentId / schoolEmail / schoolVerifiedAt /
 * createdAt 노출. BE 응답 (`/api/me`) 이 이미 PR #546 에서 추가했으므로 FE 는 그대로 전달.
 * 누락 필드는 null 정규화 (createdAt 만 undefined — 신규 가입 흐름 외에 표시 의무 없음).
 */
import { useEffect, useState } from 'react';

import { api } from './api.js';

/**
 * @typedef {{
 *   sub: string;
 *   email: string;
 *   name: string;
 *   nickname: string | null;
 *   studentId: string | null;
 *   schoolEmail: string | null;
 *   schoolVerifiedAt: string | null;
 *   createdAt?: string;
 * }} SessionUser
 */

/**
 * @param {unknown} raw
 * @returns {SessionUser | null}
 */
const normalizeUser = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  const sub = typeof r.sub === 'string' ? r.sub : null;
  if (!sub) return null;
  /** @type {(v: unknown) => string | null} */
  const orNull = (v) => (typeof v === 'string' && v.length > 0 ? v : null);
  return {
    sub,
    email: typeof r.email === 'string' ? r.email : '',
    name: typeof r.name === 'string' ? r.name : '',
    nickname: orNull(r.nickname),
    studentId: orNull(r.studentId),
    schoolEmail: orNull(r.schoolEmail),
    schoolVerifiedAt: orNull(r.schoolVerifiedAt),
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : undefined,
  };
};

/** @returns {{ status: 'loading' | 'authenticated' | 'unauthenticated', user: SessionUser | null }} */
export const useSession = () => {
  const [state, setState] = useState(
    /** @type {{ status: 'loading' | 'authenticated' | 'unauthenticated', user: SessionUser | null }} */ ({
      status: 'loading',
      user: null,
    }),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.me();
        if (cancelled) return;
        const user = normalizeUser(res?.data?.user);
        setState({ status: user ? 'authenticated' : 'unauthenticated', user });
      } catch {
        if (cancelled) return;
        setState({ status: 'unauthenticated', user: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
