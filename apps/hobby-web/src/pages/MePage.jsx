import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { MeetupCard } from '../components/MeetupCard.jsx';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';

import { MePageEmpty, MyApplicationCard, MyPageShell, TabButton } from './MePage.parts.jsx';

/**
 * 마이페이지 — `/me` (#228).
 *
 * 탭:
 *  - 내가 만든 모임 (`GET /api/me/posts`, CLOSED 포함)
 *  - 내가 신청한 모임 (`GET /api/me/applications`, 카드 + 취소 버튼)
 *
 * 비로그인이면 auth.get-it.cloud 로 즉시 redirect.
 *
 * 컴포넌트 분리: MePage.parts.jsx 에 카드/탭/empty/shell 위치 (300줄 cap).
 */
export const MePage = () => {
  const [tab, setTab] = useState(/** @type {'created'|'applied'} */ ('created'));
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
    staleTime: 60_000,
  });

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

  if (meQuery.isError || !meQuery.data) {
    // 비로그인 → SSO 로 보냄.
    if (typeof window !== 'undefined') {
      const here = encodeURIComponent(`${window.location.origin}/me`);
      window.location.href = `https://auth.get-it.cloud/login?redirect=${here}`;
    }
    return (
      <MyPageShell>
        <p
          role="status"
          className="mt-20 text-center text-slate-500 dark:text-slate-400 font-round"
        >
          로그인 페이지로 이동 중…
        </p>
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
          {me.name ?? me.email ?? '익명'} 님이 만든·신청한 모임을 한 곳에서.
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
 * "내가 만든 모임" 탭 — MeetupCard 재사용. CLOSED 포함.
 * 페이지네이션은 cursor; "더 둘러보기" 버튼.
 */
const MyCreatedTab = () => {
  const query = useQuery({
    queryKey: ['me', 'posts'],
    queryFn: () => api.listMyPosts({ limit: 24 }),
    staleTime: 30_000,
  });
  if (query.isLoading) {
    return (
      <p role="status" className="text-slate-500 dark:text-slate-400 font-round">
        내가 만든 모임 가져오는 중…
      </p>
    );
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

  if (query.isLoading) {
    return (
      <p role="status" className="text-slate-500 dark:text-slate-400 font-round">
        신청한 모임 가져오는 중…
      </p>
    );
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
  return (
    <ul aria-label="내가 신청한 모임" className={cn('grid grid-cols-1 md:grid-cols-2 gap-5')}>
      {items.map((item) => (
        <MyApplicationCard
          key={item.id}
          item={item}
          onCancel={() => cancel.mutate(item.id)}
          isPending={cancel.isPending}
        />
      ))}
    </ul>
  );
};
