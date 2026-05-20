/**
 * About 섹션 (Tech-Dark).
 * - id="about" 앵커 + 12-col grid (md+): col-span-4 (H2) + col-span-7 col-start-6 (본문)
 * - 마커: `[01] about` mono · cyan prefix
 * - H2: mono · "작지만, / 진짜 프로덕션."
 * - 본문: `auth.get-it.cloud` 인라인 code (cyan 액센트)
 */
export const About = () => {
  return (
    <section
      id="about"
      data-testid="about-section"
      aria-labelledby="about-heading"
      className="border-t border-hairline bg-white dark:bg-ink-950"
    >
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-24 lg:px-10">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
              <span className="text-cyan-700 dark:text-cyan-neon">[01]</span> about
            </p>
            <h2
              id="about-heading"
              className="font-mono text-3xl font-semibold tracking-tight text-ink-950 dark:text-white"
            >
              작지만,
              <br />
              진짜 프로덕션.
            </h2>
          </div>

          <div className="space-y-5 text-base leading-relaxed text-zinc-600 md:col-span-7 md:col-start-6 dark:text-zinc-300">
            <p>
              GETIT 9기 멘토링은 한 학기 동안 네 개의 제품을 실제로 운영합니다. 기획부터 디자인,
              풀스택 구현, 배포, 운영까지 — 학회 활동을 넘어 실제 사용자가 쓰는 제품을 만드는 것이
              목표입니다.
            </p>
            <p>
              모든 서비스는 하나의{' '}
              <code className="font-mono text-cyan-700 dark:text-cyan-neon">auth.get-it.cloud</code>{' '}
              SSO로 연결되고, 다크모드와 모바일을 기본으로 지원합니다.{' '}
              <span className="text-zinc-900 dark:text-white">
                코드와 디자인 모두 공개되어 있습니다.
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
