/**
 * Hero 섹션.
 * - Eyebrow: 인디고 도트 + "9th Cohort Mentoring · 경북대학교"
 * - H1: text-6xl ~ text-7xl, tracking tightest, leading-[0.95]
 * - 부연: 1-2 문장
 * - CTA 2개: Primary "프로젝트 보기" → #projects, Secondary "9기 소개" → #about
 * - 메타라인 <dl>: Projects 04 / Cohort 9th / SSO Unified / Domain get-it.cloud
 * - 배경: dot-grid (시안 minimalist.html:211)
 */

const META = [
  { label: 'Projects', value: '04' },
  { label: 'Cohort', value: '9th' },
  { label: 'SSO', value: 'Unified' },
  { label: 'Domain', value: 'get-it.cloud' },
];

export const Hero = () => {
  return (
    <section className="relative overflow-hidden">
      <div
        data-testid="hero-dot-grid"
        aria-hidden="true"
        className="dot-grid pointer-events-none absolute inset-0 opacity-70"
      />
      <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-10 md:py-32">
        <div className="mb-8 flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-background/60 px-2.5 py-1 text-[11px] font-medium tracking-wide text-muted-foreground backdrop-blur">
            <span
              data-testid="eyebrow-dot"
              className="h-1.5 w-1.5 rounded-full bg-indigo-accent"
              aria-hidden="true"
            />
            9th Cohort Mentoring · 경북대학교
          </span>
        </div>

        <h1 className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-tightest text-foreground md:text-7xl">
          9기 멘토링
          <br />
          <span className="text-muted-foreground">프로젝트.</span>
        </h1>

        <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          네 개의 풀스택 서비스를 한 허브에서. SSO·다크모드·반응형 완비.
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <a
            href="#projects"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            프로젝트 보기
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </a>
          <a
            href="#about"
            className="inline-flex items-center gap-2 rounded-md border border-hairline px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            9기 소개
          </a>
        </div>

        <dl
          data-testid="hero-meta"
          className="mt-20 grid max-w-3xl grid-cols-2 gap-x-10 gap-y-6 border-t border-hairline pt-8 md:grid-cols-4"
        >
          {META.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-mono text-base font-semibold tracking-tight text-foreground md:text-lg">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-10 font-mono text-xs tracking-wider text-muted-foreground">
          EST. 2026 · GETIT/9
        </p>
      </div>
    </section>
  );
};
