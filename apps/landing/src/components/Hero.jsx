/**
 * Hero 섹션.
 * - Eyebrow: 인디고 도트 + "9th Cohort Mentoring · 경북대학교"
 * - H1: text-6xl ~ text-7xl, tracking tightest, leading-[0.95]
 * - 부연: 1-2 문장
 * - 메타: font-mono 작은 캡션 (EST. 2026 · GETIT/9)
 */
export const Hero = () => {
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-10 md:py-32">
        <div className="mb-8 flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-medium tracking-wide text-muted-foreground">
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

        <p className="mt-10 font-mono text-xs tracking-wider text-muted-foreground">
          EST. 2026 · GETIT/9
        </p>
      </div>
    </section>
  );
};
