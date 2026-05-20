/**
 * 빈 자리 placeholder 카드 — 시안 (playful.html) 의 카드 7 (dashed border) 1:1.
 * "찾는 모임 없으면 직접 만들자" CTA.
 */
export const EmptyCard = () => (
  <a
    href="/new"
    data-testid="empty-card"
    className="group block rounded-[28px] p-6 relative overflow-hidden border-2 border-dashed border-slate-300 dark:border-white/15 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:-rotate-1 hover:scale-[1.02] transition shadow-sm"
  >
    <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center gap-3">
      <span aria-hidden="true" className="text-6xl float-mid" style={{ ['--r']: '-6deg' }}>
        🪄
      </span>
      <h3 className="font-display font-extrabold text-xl text-slate-800 dark:text-slate-100">
        여기 빈 자리!
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-round max-w-[220px]">
        찾는 모임이 없어? 직접 한 판 깔아보자.
      </p>
      <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-4 py-2 font-display font-bold text-sm group-hover:scale-105 group-hover:rotate-1 transition">
        ＋ 새 모임 만들기
      </span>
    </div>
  </a>
);
