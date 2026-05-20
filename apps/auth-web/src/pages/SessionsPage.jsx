import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { SubmitButton } from '../components/SubmitButton.jsx';
import { Toast } from '../components/Toast.jsx';
import { api } from '../lib/api.js';

/**
 * 활성 세션 페이지 (Issue #321 일부).
 *
 * - GET /api/me/sessions 로 세션 목록 표시.
 * - "다른 기기 모두 로그아웃" 버튼 → POST /api/me/sessions/revoke-others.
 */
export const SessionsPage = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(/** @type {Array<any>} */ ([]));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(/** @type {string|null} */ (null));

  const load = () => {
    setLoading(true);
    api
      .sessions()
      .then((r) => setSessions(r.data?.sessions ?? []))
      .catch(() => navigate('/login?redirect=/sessions', { replace: true }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [navigate]);

  const revokeOthers = async () => {
    setBusy(true);
    try {
      const r = await api.revokeOtherSessions();
      setToast(`${r.data?.revoked ?? 0}개 세션을 종료했습니다`);
      load();
    } catch {
      setToast('실패 · 잠시 후 다시 시도해주세요');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <Toast message={toast} onDone={() => setToast(null)} />
      <header className="flex flex-col gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
          <span className="text-cyan-700 dark:text-cyan-neon">~/auth/me/sessions</span>
        </div>
        <h1 className="font-mono text-3xl font-semibold tracking-tightest text-ink-950 dark:text-white">
          활성 세션
        </h1>
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          현재 로그인된 기기/세션 목록입니다
        </p>
      </header>

      {loading ? (
        <p className="font-mono text-[12px] text-zinc-500">불러오는 중…</p>
      ) : sessions.length === 0 ? (
        <p className="font-mono text-[12px] text-zinc-500">활성 세션이 없습니다</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="rounded-md border border-hairline bg-white/60 px-3 py-2 font-mono text-[11px] text-zinc-700 dark:bg-ink-900/40 dark:text-zinc-300"
            >
              <div>session: {s.id}</div>
              <div className="text-zinc-500">
                created: {new Date(s.createdAt).toLocaleString('ko-KR')}
              </div>
              <div className="text-zinc-500">
                expires: {new Date(s.expiresAt).toLocaleString('ko-KR')}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          revokeOthers();
        }}
      >
        <SubmitButton loading={busy} loadingText="처리 중…" tone="destructive">
          다른 기기 모두 로그아웃
        </SubmitButton>
      </form>

      <p className="text-center font-mono text-[12px] text-zinc-600 dark:text-zinc-300">
        <Link to="/profile" className="hover:text-cyan-700 dark:hover:text-cyan-neon">
          프로필로 돌아가기
        </Link>
      </p>
    </div>
  );
};
