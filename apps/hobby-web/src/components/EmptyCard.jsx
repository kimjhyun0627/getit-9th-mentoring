import { Link } from 'react-router-dom';

/**
 * 빈 자리 placeholder 카드 — 시안 (playful.html) 의 카드 7 (dashed border) 1:1.
 *
 * 두 컨텍스트에서 모두 렌더:
 *  - `empty`: 모집이 0개일 때 — "첫 모임을 만들어볼래?" 톤
 *  - `cta`:   카드가 있어도 그리드 마지막 슬롯 — "또 다른 모임?" CTA
 *
 * @param {{ mode?: 'empty' | 'cta' }} props
 */
export const EmptyCard = ({ mode = 'cta' }) => {
  const heading = mode === 'empty' ? '여기 빈 자리!' : '또 다른 모임?';
  const bodyLines =
    mode === 'empty'
      ? ['아직 모집이 없어.', '첫 모임을 만들어볼래?']
      : ['마음에 드는 게 없어?', '직접 한 판 깔아보자.'];

  return (
    <Link
      to="/new"
      data-testid="empty-card"
      className="group block rounded-[28px] p-6 relative overflow-hidden border-2 border-dashed border-slate-300 dark:border-white/15 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:-rotate-1 hover:scale-[1.02] transition shadow-sm"
    >
      <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center gap-3">
        <span aria-hidden="true" className="text-6xl float-mid" style={{ ['--r']: '-6deg' }}>
          🪄
        </span>
        <h3 className="font-display font-extrabold text-xl text-slate-800 dark:text-slate-100 break-keep">
          {heading}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-round max-w-[220px] break-keep [overflow-wrap:anywhere]">
          {bodyLines[0]}
          <br />
          {bodyLines[1]}
        </p>
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-4 py-2 font-display font-bold text-sm group-hover:scale-105 group-hover:rotate-1 transition">
          ＋ 새 모임 만들기
        </span>
      </div>
    </Link>
  );
};
