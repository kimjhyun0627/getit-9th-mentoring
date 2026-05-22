import { displayName } from '@getit/auth-utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { MeetupCard } from '../components/MeetupCard.jsx';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';

import {
  MePageEmpty,
  MyApplicationCard,
  MyPageShell,
  RedirectingNotice,
  TabButton,
} from './MePage.parts.jsx';

/**
 * 마이페이지 — `/me` (#228).
 *
 * 탭 (URL 동기화):
 *  - `/me?tab=created` (기본) — 내가 만든 모임 (`GET /api/me/posts`, CLOSED 포함)
 *  - `/me?tab=applied`        — 내가 신청한 모임 (`GET /api/me/applications`)
 *
 * URL 동기화: 브라우저 뒤로/공유 URL 로 탭이 유지됨 (Gemini review #340).
 *
 * 비로그인이면 auth.get-it.cloud 로 redirect. side-effect 는 useEffect 안에서만
 * 수행 — 렌더 본문에서 `window.location.href = ...` 를 직접 건드리면 렌더 사이클이 깨짐.
 *
 * 컴포넌트 분리: MePage.parts.jsx 에 카드/탭/empty/shell 위치 (300줄 cap).
 */
export const MePage = () => {
  const [params, setParams] = useSearchParams();
  const tabRaw = params.get('tab');
  const tab = /** @type {'created'|'applied'} */ (tabRaw === 'applied' ? 'applied' : 'created');
  const setTab = (next) => {
    const updated = new URLSearchParams(params);
    if (next === 'created') updated.delete('tab');
    else updated.set('tab', next);
    setParams(updated, { replace: true });
  };

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 60_000,
  });

  // 401(인증 실패) 일 때만 SSO redirect. network/5xx 은 재시도 UX 로 분리 — 사용자가
  // 의도치 않게 로그인 화면으로 튀지 않도록 (CR review #340).
  const meStatus = meQuery.error?.response?.status;
  const is401 = meStatus === 401;
  useEffect(() => {
    if (meQuery.isLoading) return;
    if (meQuery.data) return;
    if (!is401) return;
    if (typeof window === 'undefined') return;
    const here = encodeURIComponent(`${window.location.origin}/me`);
    window.location.href = `https://auth.get-it.cloud/login?redirect=${here}`;
  }, [meQuery.isLoading, meQuery.data, is401]);

  if (meQuery.isLoading) {
    return (
      <MyPageShell>
        <p
          role="status"
          className="mt-20 text-center text-slate-500 dark:text-slate-400 font-round"
        >
          로그인 확인 중…
        </p>
      </MyPageShell>
    );
  }

  if (!meQuery.data) {
    if (is401) {
      return (
        <MyPageShell>
          <RedirectingNotice />
        </MyPageShell>
      );
    }
    // 401 이 아닌 에러 (5xx/네트워크) — 재시도 UX.
    return (
      <MyPageShell>
        <div className="mt-20 text-center font-round">
          <p role="alert" className="text-rose-600 dark:text-rose-300 font-bold">
            마이페이지를 불러오지 못했어
          </p>
          <button
            type="button"
            onClick={() => meQuery.refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 text-sm font-display font-bold shadow-sm"
          >
            다시 시도
          </button>
        </div>
      </MyPageShell>
    );
  }

  const me = meQuery.data;

  return (
    <MyPageShell>
      <main className="relative z-10 max-w-5xl mx-auto px-5 lg:px-10 pt-10 pb-16">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-slate-900 dark:text-white">
          내 모임 <span aria-hidden="true">🤝</span>
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 font-round">
          {displayName(me, me.email ?? '익명')} 님이 만든·신청한 모임을 한 곳에서.
        </p>

        <div role="tablist" aria-label="마이페이지 탭" className="mt-7 flex items-center gap-2">
          <TabButton active={tab === 'created'} onClick={() => setTab('created')} count={null}>
            내가 만든 모임
          </TabButton>
          <TabButton active={tab === 'applied'} onClick={() => setTab('applied')} count={null}>
            내가 신청한 모임
          </TabButton>
        </div>

        <section className="mt-7">
          {tab === 'created' ? <MyCreatedTab /> : <MyAppliedTab />}
        </section>
      </main>
    </MyPageShell>
  );
};

/**
 * 401 → SSO 로그인 redirect (useEffect 안에서만).
 *
 * `meQuery` 가 200 캐시로 살아있어도 (staleTime 60s), 탭 데이터 쿼리는
 * access token 만료로 401 을 받을 수 있다. interceptor 가 `/api/refresh`
 * 한 번을 시도한 뒤에도 401 이 떨어지면 진짜 expired — SSO 페이지로 보내야
 * 사용자가 "데이터 안 보임" 상태에 갇히지 않는다.
 *
 * @param {boolean} is401
 */
const useSsoRedirectOn401 = (is401) => {
  useEffect(() => {
    if (!is401) return;
    if (typeof window === 'undefined') return;
    const here = encodeURIComponent(`${window.location.origin}/me`);
    window.location.href = `https://auth.get-it.cloud/login?redirect=${here}`;
  }, [is401]);
};

/**
 * "내가 만든 모임" 탭 — MeetupCard 재사용. CLOSED 포함.
 * 페이지네이션은 cursor; "더 둘러보기" 버튼.
 */
const MyCreatedTab = () => {
  const query = useQuery({
    queryKey: ['me', 'posts'],
    queryFn: () => api.listMyPosts({ limit: 24 }),
    staleTime: 30_000,
  });
  const is401 = query.error?.response?.status === 401;
  useSsoRedirectOn401(is401);
  if (query.isLoading) {
    return (
      <p role="status" className="text-slate-500 dark:text-slate-400 font-round">
        내가 만든 모임 가져오는 중…
      </p>
    );
  }
  if (is401) {
    return <RedirectingNotice />;
  }
  if (query.isError) {
    return (
      <p role="alert" className="text-rose-600 dark:text-rose-300 font-round font-bold">
        불러오지 못했어. 잠시 후 다시 시도해줘.
      </p>
    );
  }
  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <MePageEmpty
        emoji="📭"
        title="아직 내가 만든 모임이 없어"
        body="첫 모임을 만들어 학우들을 모아봐."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
      {items.map((post) => (
        <MeetupCard key={post.id} post={post} />
      ))}
    </div>
  );
};

/**
 * "내가 신청한 모임" 탭 — MyApplicationCard 사용 + 취소 mutation.
 */
const MyAppliedTab = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['me', 'applications'],
    queryFn: () => api.listMyApplications({ limit: 24 }),
    staleTime: 30_000,
  });

  const cancel = useMutation({
    mutationFn: (appId) => api.cancelApplication(appId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'applications'] });
    },
  });
  const is401 = query.error?.response?.status === 401;
  useSsoRedirectOn401(is401);

  if (query.isLoading) {
    return (
      <p role="status" className="text-slate-500 dark:text-slate-400 font-round">
        신청한 모임 가져오는 중…
      </p>
    );
  }
  if (is401) {
    return <RedirectingNotice />;
  }
  if (query.isError) {
    return (
      <p role="alert" className="text-rose-600 dark:text-rose-300 font-round font-bold">
        불러오지 못했어. 잠시 후 다시 시도해줘.
      </p>
    );
  }
  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <MePageEmpty
        emoji="🔍"
        title="아직 신청한 모임이 없어"
        body="홈에서 마음에 드는 모임을 골라봐."
      />
    );
  }
  // 한 item 의 취소 진행 상태가 모든 카드에 전파되지 않도록 variables 로 분리.
  const pendingId = cancel.isPending ? cancel.variables : null;
  return (
    <ul aria-label="내가 신청한 모임" className={cn('grid grid-cols-1 md:grid-cols-2 gap-5')}>
      {items.map((item) => (
        <MyApplicationCard
          key={item.id}
          item={item}
          onCancel={() => cancel.mutate(item.id)}
          isPending={pendingId === item.id}
        />
      ))}
    </ul>
  );
};
