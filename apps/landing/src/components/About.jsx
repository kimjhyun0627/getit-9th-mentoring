/**
 * About 섹션.
 * - id="about" 앵커 타깃 (Header nav 및 Hero CTA 에서 진입).
 * - 12-col grid (md+): col-span-4 (H2) + col-span-7 col-start-6 (본문).
 * - 시안 minimalist.html:506-537 라인 구조 1:1.
 */
export const About = () => {
  return (
    <section
      id="about"
      data-testid="about-section"
      aria-labelledby="about-heading"
      className="border-t border-hairline"
    >
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 md:py-28">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              — About
            </p>
            <h2
              id="about-heading"
              className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
            >
              작지만, 진짜 프로덕션.
            </h2>
          </div>

          <div className="space-y-5 text-base leading-relaxed text-muted-foreground md:col-span-7 md:col-start-6">
            <p>
              GETIT 9기 멘토링은 한 학기 동안 네 개의 제품을 실제로 운영해요. 기획부터 디자인,
              풀스택 구현, 배포, 운영까지 — 학회 활동을 넘어 실제 사용자가 쓰는 제품을 만드는 것이
              목표예요.
            </p>
            <p>
              모든 서비스는 하나의 SSO로 연결되어 있고, 다크모드와 모바일을 기본으로 지원해요.
              코드와 디자인 모두 공개되어 있어요.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
