/**
 * Team / Timeline 섹션 (#222) — 9기 허브 정체성 강화.
 *
 * 현재 페이지는 "9기 멘토링 허브"라는 자기 소개만 추상적으로 가지고 있어서
 * 멘토/멘티/일정/규모 같은 9기-specific 콘텐츠가 부족. 이 섹션이 그 빈자리를 채운다.
 *
 * Option A (stat strip) + Option B (timeline 미니) 조합:
 * - stat strip: `04 mentors · 12 mentees · 14 weeks · 04 products`
 * - timeline: Week 1 kickoff → Week 14 demo day
 *
 * 실제 멘토/멘티 명단 자체는 개인정보라 out of scope (PM 결정 필요).
 * 숫자/구조만 노출하고 명단은 노션 링크로 위임.
 *
 * Tech-Dark 톤 유지: `[02] team` 마커, mono, cyan dot, 액센트 네온 4종 분배.
 */

/**
 * Stat strip 한 셀.
 *
 * @param {{ label: string; value: string; tone?: 'default' | 'cyan' | 'magenta' | 'lime' | 'amber' }} props
 */
const StatCell = ({ label, value, tone = 'default' }) => {
  const valueClass =
    tone === 'cyan'
      ? 'text-cyan-700 dark:text-cyan-neon'
      : tone === 'magenta'
        ? 'text-fuchsia-700 dark:text-magenta-neon'
        : tone === 'lime'
          ? 'text-lime-700 dark:text-lime-neon'
          : tone === 'amber'
            ? 'text-amber-700 dark:text-amber-neon'
            : 'text-ink-950 dark:text-white';
  return (
    <div data-testid="team-stat">
      <dt className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
        {label}
      </dt>
      <dd className={`mt-1 font-mono text-3xl font-semibold tracking-tight ${valueClass}`}>
        {value}
      </dd>
    </div>
  );
};

/** 4 마일스톤 timeline (mono dot + 라벨). */
const MILESTONES = [
  { week: 'W01', label: 'kickoff' },
  { week: 'W05', label: 'mvp' },
  { week: 'W10', label: 'beta' },
  { week: 'W14', label: 'demo day' },
];

export const Team = () => {
  return (
    <section
      id="team"
      data-testid="team-section"
      aria-labelledby="team-heading"
      className="border-t border-hairline bg-white dark:bg-ink-950"
    >
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-24 lg:px-10">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
              <span className="text-cyan-700 dark:text-cyan-neon">[02]</span> team / timeline
            </p>
            <h2
              id="team-heading"
              className="font-mono text-3xl font-semibold tracking-tight text-ink-950 md:text-4xl dark:text-white"
            >
              멘토 · 멘티 · 일정.
            </h2>
          </div>
          <div
            aria-hidden="true"
            className="hidden items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 sm:flex dark:text-zinc-500"
          >
            <div className="divider-mono w-24 text-zinc-300 dark:text-zinc-700" />
            <span>14 weeks</span>
          </div>
        </div>

        <dl
          data-testid="team-stat-strip"
          className="grid grid-cols-2 gap-x-10 gap-y-6 border-t border-hairline pt-8 font-mono sm:grid-cols-4"
        >
          <StatCell label="mentors" value="04" tone="cyan" />
          <StatCell label="mentees" value="12" tone="magenta" />
          <StatCell label="weeks" value="14" tone="lime" />
          <StatCell label="products" value="04" tone="amber" />
        </dl>

        <ol
          aria-label="기수 일정 마일스톤"
          className="mt-12 grid grid-cols-2 gap-y-6 border-t border-hairline pt-8 sm:grid-cols-4"
        >
          {MILESTONES.map(({ week, label }, idx) => (
            <li key={week} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-1 inline-block size-2 rounded-full ${
                  idx === 0
                    ? 'bg-cyan-700 dark:bg-cyan-neon'
                    : idx === MILESTONES.length - 1
                      ? 'bg-lime-700 dark:bg-lime-neon'
                      : 'bg-zinc-300 dark:bg-zinc-600'
                }`}
              />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
                  {week}
                </p>
                <p className="mt-1 font-mono text-sm text-ink-950 dark:text-white">{label}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          멘토 · 멘티 전체 명단과 주차별 상세 일정은{' '}
          <a
            href="https://knu-getit.notion.site/363694c484f780ca9ef2d0feeb53503b"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-neon"
          >
            노션 본부
            <span className="sr-only"> — 새 탭에서 열림</span>
            <span aria-hidden="true"> ↗</span>
          </a>{' '}
          에서 볼 수 있어요.
        </p>
      </div>
    </section>
  );
};
