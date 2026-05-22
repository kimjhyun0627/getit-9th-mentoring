/**
 * useSession (shelf-web, #540) — auth-api `GET /api/me` 핑으로 SSO 세션 상태 확인.
 *
 * shelf-web 은 외부인도 사용할 수 있는 서비스 (학교 인증 가드 X). 그래도
 * 로그인 사용자의 nickname onboarding 강제 redirect 는 적용 — 닉네임은 SSO 1급 필드.
 *
 * 동작:
 *  - mount 시 `${VITE_AUTH_URL}/api/me` fetch (credentials: include, no-store).
 *  - 200 + user 형식이면 user 노출, 그 외는 fail-soft (null).
 *  - 5xx / 네트워크 / abort 시 user=null + loading=false.
 *
 * 반환:
 *  - `user`: { sub, email?, name?, nickname, studentId, schoolEmail, schoolVerifiedAt, createdAt }
 *  - `loading`: 초기 fetch 진행 여부.
 *
 * fail-soft 의도: shelf-web home 은 외부인도 둘러볼 수 있어야 하니 /me 가 흔들려도
 * 페이지는 죽지 않게. nickname onboarding 도 user=null (비로그인) 이면 skip.
 *
 * @returns {{
 *   user: {
 *     sub: string;
 *     email?: string;
 *     name?: string;
 *     nickname: string | null;
 *     studentId: string | null;
 *     schoolEmail: string | null;
 *     schoolVerifiedAt: string | null;
 *     createdAt?: string;
 *   } | null,
 *   loading: boolean,
 * }}
 */
import { useEffect, useState } from 'react';
import { z } from 'zod';

const AUTH_ORIGIN = import.meta.env?.VITE_AUTH_URL || 'https://auth.get-it.cloud';
const ME_TIMEOUT_MS = 3000;

/**
 * trim 후 비어있지 않은 string 을 trim 된 값으로 반환. 그 외는 null (CR Major #550).
 * CR nitpick #550: 원본이 아니라 trim 된 값을 반환 — surrounding whitespace 제거.
 *
 * @param {unknown} v
 * @returns {string | null}
 */
const orNullableNonEmpty = (v) => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

const SessionUserSchema = z
  .object({
    sub: z.string().min(1),
    email: z.string().optional(),
    name: z.string().optional(),
    nickname: z.string().nullish(),
    studentId: z.string().nullish(),
    schoolEmail: z.string().nullish(),
    schoolVerifiedAt: z.string().nullish(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export const useSession = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ME_TIMEOUT_MS);

    const probe = async () => {
      try {
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
          const d = parsed.data;
          setUser({
            sub: d.sub,
            email: d.email,
            name: d.name,
            // CR Major #550 — 공백/빈 문자열도 null 정규화 (orNullableNonEmpty).
            nickname: orNullableNonEmpty(d.nickname),
            studentId: orNullableNonEmpty(d.studentId),
            schoolEmail: orNullableNonEmpty(d.schoolEmail),
            schoolVerifiedAt: orNullableNonEmpty(d.schoolVerifiedAt),
            createdAt: d.createdAt,
          });
        } else {
          setUser(null);
        }
      } catch {
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
