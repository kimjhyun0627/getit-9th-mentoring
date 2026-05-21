import { ArrowIcon } from './ArrowIcon.jsx';
import { ExternalLinkIcon } from './ExternalLinkIcon.jsx';

/**
 * 4-up metaline (시안 dl).
 * mono · 우상단 `04 / 05 / unified / 100% open` 시그니처.
 * cyan_neon (sso=unified), lime_neon (source=100% open) 부분 액센트.
 *
 * @type {{ label: string; value: string; tone?: 'default' | 'cyan' | 'lime' }[]}
 */
const META = [
  { label: 'projects', value: '04' },
  { label: 'subdomains', value: '05' },
  { label: 'sso', value: 'unified', tone: 'cyan' },
  { label: 'source', value: '100% open', tone: 'lime' },
];

/**
 * mono dl 한 셀 — tone에 따라 value 색만 다름.
 *
 * @param {{ label: string; value: string; tone?: 'default' | 'cyan' | 'lime' }} props
 */
const MetaCell = ({ label, value, tone = 'default' }) => {
  const valueClass =
    tone === 'cyan'
      ? 'text-cyan-700 dark:text-cyan-neon'
      : tone === 'lime'
        ? 'text-lime-700 dark:text-lime-neon'
        : 'text-ink-950 dark:text-white';
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
        {label}
      </dt>
      <dd className={`mt-1 text-2xl font-semibold tracking-tight ${valueClass}`}>{value}</dd>
    </div>
  );
};

/** Hero corner registration marks ('+') — engineer/print 액센트. */
const CornerMarks = () => (
  <>
    {['left-4 top-4', 'right-4 top-4', 'bottom-4 left-4', 'bottom-4 right-4'].map((pos) => (
      <div
        key={pos}
        aria-hidden="true"
        className={`pointer-events-none absolute font-mono text-[10px] tracking-wider text-zinc-500 dark:text-zinc-600 ${pos}`}
      >
        +
      </div>
    ))}
  </>
);

/**
 * Hero 섹션 (Tech-Dark).
 * - 배경: scene-dark (cyan/magenta 라디얼 + 48px 그리드) + scanlines + corner '+'
 * - meta strip: `~/getit/9 · region: knu · build: 2026.05 · stage live`
 * - eyebrow: cyan dot + "GET IT · 9th"
 * - H1: mono + tracking-tightest, `프로젝트.deploy()` + cyan blink caret
 * - CTA 2개: `./explore --all` (cyan 인버스 버튼) + `./git remote` (외부 GitHub, #469)
 * - 4-up metaline: projects(04) / subdomains(05) / sso(unified, cyan) / source(100% open, lime)
 */
export const Hero = () => {
  return (
    <section className="scene-dark scanlines relative overflow-hidden">
      <CornerMarks />

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 md:pb-32 md:pt-28 lg:px-10">
        <div
          data-testid="hero-meta-strip"
          className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500"
        >
          <span className="text-cyan-700 dark:text-cyan-neon">~/getit/9</span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span>region: knu</span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span>build: 2026.05</span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span>
            stage <span className="text-lime-700 dark:text-lime-neon">live</span>
          </span>
        </div>

        <div className="mb-7 flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white/50 px-2.5 py-1 font-mono text-[11px] font-medium tracking-wide text-zinc-600 backdrop-blur dark:bg-ink-900/50 dark:text-zinc-300">
            <span
              data-testid="eyebrow-dot"
              className="h-1.5 w-1.5 rounded-full bg-cyan-700 dark:bg-cyan-neon"
              aria-hidden="true"
            />
            GET IT · 9th
          </span>
        </div>

        <h1 className="max-w-5xl font-mono text-5xl font-semibold leading-[0.96] tracking-tightest text-ink-950 sm:text-6xl md:text-7xl dark:text-white">
          9기 멘토링
          <br />
          <span className="text-zinc-400 dark:text-zinc-500">프로젝트</span>
          <span className="text-cyan-700 dark:text-cyan-neon">.deploy()</span>
          <span
            data-testid="hero-caret"
            className="caret text-cyan-700 dark:text-cyan-neon"
            aria-hidden="true"
          />
        </h1>

        <p className="mt-8 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-300">
          {/* #463 — '작은 제품'/'플레이그라운드' 자기비하 톤 폐기. About '진짜 프로덕션' 와 정합. */}
          경북대 GETIT 9기가 만드는 네 개의 풀스택 제품.
          <br />
          하나의 SSO, 공통 다크모드,
          <br />실 운영 모노레포.
        </p>

        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <a
            href="#projects"
            aria-label="./explore --all (전체 프로젝트 보기)"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink-950 px-4 py-2.5 font-mono text-sm font-semibold text-cyan-neon transition hover:brightness-110 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 sm:w-auto sm:justify-start dark:bg-cyan-neon dark:text-ink-950 dark:shadow-[0_0_0_1px_rgba(34,211,238,0.4),0_0_28px_-4px_rgba(34,211,238,0.55)] dark:focus-visible:outline-cyan-neon"
          >
            <span aria-hidden="true">./explore --all</span>
            <ArrowIcon />
          </a>

          <a
            href="https://github.com/kimjhyun0627/getit-9th-mentoring"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="./git remote (GitHub 저장소) — 새 탭에서 열림"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-hairline bg-white/60 px-4 py-2.5 font-mono text-sm text-zinc-800 transition hover:border-zinc-500 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 sm:w-auto sm:justify-start dark:bg-ink-900/60 dark:text-zinc-200 dark:hover:border-zinc-400 dark:focus-visible:outline-cyan-neon"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-1.92c-3.2.7-3.88-1.54-3.88-1.54-.52-1.32-1.28-1.67-1.28-1.67-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.66.79.55C20.21 21.39 23.5 17.08 23.5 12A11.5 11.5 0 0 0 12 .5Z" />
            </svg>
            <span aria-hidden="true">./git remote</span>
            <ExternalLinkIcon />
          </a>
        </div>

        <dl
          data-testid="hero-meta"
          className="mt-20 grid max-w-4xl grid-cols-2 gap-x-10 gap-y-6 border-t border-hairline pt-8 font-mono md:grid-cols-4"
        >
          {META.map(({ label, value, tone }) => (
            <MetaCell key={label} label={label} value={value} tone={tone} />
          ))}
        </dl>
      </div>
    </section>
  );
};
