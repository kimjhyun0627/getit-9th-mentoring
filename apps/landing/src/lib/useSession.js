import { useEffect, useState } from 'react';
import { z } from 'zod';

/**
 * landing 헤더 SSO 세션 상태 hook (#343 / #246, school-auth #540 확장).
 *
 * 동작:
 *  - mount 시 `auth.get-it.cloud/api/me` 를 fetch (credentials: 'include').
 *  - cookie 가 `.get-it.cloud` SLD 에 묶여있어 cross-domain 으로 전송됨 (COOKIE_DOMAIN=.get-it.cloud).
 *  - 200 + `{ user: {...} }` → 로그인 상태로 user 노출. zod safeParse 로 응답 schema 검증.
 *  - 401 / 5xx / 네트워크 에러 / 잘못된 응답 형태 → **fail-soft**: 비로그인으로 조용히 처리.
 *
 * fail-soft 사유: landing 은 진입 페이지 + 공개 콘텐츠. /me 가 흔들려도
 * 페이지 자체는 동작해야 한다. 로그인이 안 보이면 사용자는 다시 `sign in` 누르면 그만.
 * console.error 도 의도적으로 silence — 정상 응답 경로의 일부.
 *
 * AUTH_ORIGIN 은 `auth-redirect.js` 와 동일 env 변수를 공유 (`VITE_AUTH_ORIGIN`).
 *
 * CR feedback (#351):
 *  - AbortController + 3s 타임아웃 → fetch hang 시 loading=true 영구 잠금 차단.
 *  - zod safeParse → 수기 typeof 체크 대신 schema-based 검증으로 일관성.
 *
 * school-auth (#540) 확장:
 *  - `nickname / studentId / schoolEmail / schoolVerifiedAt / createdAt` 노출.
 *  - landing `/me` 마이페이지 (가입일 표시) 가 이 필드들에 의존 — 단일 출처 유지.
 *  - 모두 optional (구버전 BE 호환). null/undefined 가 들어와도 schema 통과.
 *  - 강제 nickname onboarding redirect 는 **landing 에서 미적용** (PRD 명시).
 *    landing 자체 `/me` 에서 onboarding 카드로 자연스럽게 유도.
 *
 * @returns {{
 *   user: {
 *     sub: string;
 *     email?: string;
 *     name?: string;
 *     nickname?: string | null;
 *     studentId?: string | null;
 *     schoolEmail?: string | null;
 *     schoolVerifiedAt?: string | null;
 *     createdAt?: string;
 *   } | null,
 *   loading: boolean,
 * }}
 */
const AUTH_ORIGIN = import.meta.env.VITE_AUTH_ORIGIN || 'https://auth.get-it.cloud';
const ME_TIMEOUT_MS = 3000;

const SessionUserSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  name: z.string().optional(),
  // school-auth (#540) — 모두 nullable + optional. BE 가 안 보내거나 null 이어도 통과.
  nickname: z.string().nullish(),
  studentId: z.string().nullish(),
  schoolEmail: z.string().nullish(),
  schoolVerifiedAt: z.string().nullish(),
  createdAt: z.string().optional(),
});

export const useSession = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ME_TIMEOUT_MS);

    const probe = async () => {
      try {
        // cache: 'no-store' — 라이브 버그(304 body 비어 useSession 실패) 대응.
        // BE 도 Cache-Control: no-store 보내지만 클라이언트도 명시해 conditional GET 차단.
        const res = await fetch(`${AUTH_ORIGIN}/api/me`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          setUser(null);
          return;
        }
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        const parsed = SessionUserSchema.safeParse(body?.user);
        if (parsed.success) {
          // school-auth (#540) — 신규 필드도 그대로 전달. null/undefined 정규화는
          // 호출자 (landing /me 등) 가 displayName / safeRedirect 헬퍼로 처리.
          const {
            sub,
            email,
            name,
            nickname,
            studentId,
            schoolEmail,
            schoolVerifiedAt,
            createdAt,
          } = parsed.data;
          setUser({
            sub,
            email,
            name,
            nickname: nickname ?? null,
            studentId: studentId ?? null,
            schoolEmail: schoolEmail ?? null,
            schoolVerifiedAt: schoolVerifiedAt ?? null,
            createdAt,
          });
        } else {
          setUser(null);
        }
      } catch {
        // fail-soft: BE-down / 네트워크 끊김 / abort → 비로그인 표시.
        if (!cancelled) setUser(null);
      } finally {
        clearTimeout(timer);
        if (!cancelled) setLoading(false);
      }
    };

    probe();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return { user, loading };
};
