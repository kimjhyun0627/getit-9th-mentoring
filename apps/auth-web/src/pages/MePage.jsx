import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { SchoolLinkCard } from '../components/SchoolLinkCard.jsx';
import { api } from '../lib/api.js';

/**
 * 마이페이지 — auth.get-it.cloud/me (Issue #539).
 *
 * - GET /api/me 로 현재 사용자 로드.
 * - SchoolLinkCard 로 학교 인증 진행/확인.
 * - `?focus=school-link` 쿼리 진입 시 학교 연동 카드 자동 scrollIntoView + highlight.
 *   landing /me + hobby home 안내 카드의 진입점 (PRD §hobby 안내 카피).
 *
 * Out of scope: 프로필 수정/비번 변경 등 — 기존 `/profile` 로 위임.
 */
export const MePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [me, setMe] = useState(/** @type {null | Record<string, unknown>} */ (null));
  const [loading, setLoading] = useState(true);

  const focusSchoolLink = searchParams.get('focus') === 'school-link';

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((r) => {
        if (cancelled) return;
        setMe(r.data?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        navigate('/login?redirect=/me', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (loading) {
    return <p className="font-mono text-[12px] text-zinc-500">불러오는 중…</p>;
  }
  if (!me) return null;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
          <span className="text-cyan-700 dark:text-cyan-neon">~/auth/me</span>
        </div>
        <h1 className="font-mono text-3xl font-semibold tracking-tightest text-ink-950 dark:text-white">
          마이페이지
        </h1>
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          계정 정보와 학교 인증 상태를 확인할 수 있어요
        </p>
      </header>

      <ProfileSummary user={me} />

      <SchoolLinkCard
        user={{
          schoolEmail: typeof me.schoolEmail === 'string' ? me.schoolEmail : null,
          studentId: typeof me.studentId === 'string' ? me.studentId : null,
          schoolVerifiedAt: typeof me.schoolVerifiedAt === 'string' ? me.schoolVerifiedAt : null,
        }}
        focus={focusSchoolLink}
        onSessionExpired={() => navigate('/login?redirect=/me', { replace: true })}
      />

      <div className="divider-mono text-zinc-300 dark:text-zinc-700" aria-hidden="true" />

      <div className="flex flex-col gap-2 font-mono text-[12px] text-zinc-600 dark:text-zinc-300">
        <Link to="/profile" className="hover:text-cyan-700 dark:hover:text-cyan-neon">
          프로필 / 비밀번호 수정 <span aria-hidden="true">./profile</span>
        </Link>
        <Link to="/sessions" className="hover:text-cyan-700 dark:hover:text-cyan-neon">
          활성 세션 관리 <span aria-hidden="true">./sessions</span>
        </Link>
      </div>
    </div>
  );
};

/**
 * 사용자 정보 요약 — 닉네임 / 이메일 / 이름.
 *
 * @param {{ user: Record<string, unknown> }} props
 */
const ProfileSummary = ({ user }) => {
  const name = typeof user.name === 'string' ? user.name : '';
  const email = typeof user.email === 'string' ? user.email : '';
  const nickname = typeof user.nickname === 'string' ? user.nickname : null;
  return (
    <section
      aria-labelledby="me-profile-heading"
      className="flex flex-col gap-2 rounded-md border border-hairline bg-white/60 p-4 dark:bg-ink-900/40"
    >
      <h2
        id="me-profile-heading"
        className="font-mono text-sm font-semibold tracking-tight text-ink-950 dark:text-white"
      >
        프로필
      </h2>
      {/* Gemini medium: "이름" 자리는 실제 name, "닉네임" 은 별도 row 로 분리해서 정보 중복 X. */}
      <dl className="flex flex-col gap-1.5 font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
        <Row label="이름" value={name} />
        {nickname ? <Row label="닉네임" value={nickname} /> : null}
        <Row label="이메일" value={email} />
      </dl>
    </section>
  );
};

/**
 * @param {{ label: string, value: string }} props
 */
const Row = ({ label, value }) => (
  <div className="flex items-baseline gap-3">
    <dt className="w-16 text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
      {label}
    </dt>
    <dd className="text-zinc-800 dark:text-zinc-100">{value}</dd>
  </div>
);
