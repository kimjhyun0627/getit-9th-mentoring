/**
 * Terminal-styled `git log --oneline -n 5` 시그니처 라인.
 * 시안 데이터를 그대로 보존 (실제 git 로그가 아니라 디자인 메타).
 *
 * @type {{ sha: string; message: string }[]}
 */
const GIT_LOG = [
  { sha: '3f9c1a2', message: 'feat(landing): wire SSO across 4 services' },
  { sha: '1ad77be', message: 'chore(infra): traefik + docker compose baseline' },
  { sha: 'a02e418', message: 'feat(auth): unified login + dark mode toggle' },
  { sha: '66b9d03', message: 'docs: project specs for hobby/shelf/board/letter' },
  { sha: 'e0c2210', message: 'init: monorepo (pnpm) — getit-9th-mentoring' },
];

/**
 * Footer 푸터 (Tech-Dark).
 * - 1px hairline 상단 보더
 * - 박스: `[03] git log --oneline -n 5  main ↑` 헤더 + 5줄 git log + 메타 라인
 * - 메타 라인: copyright + github/notion/mail 링크
 */
export const Footer = () => {
  return (
    <footer className="border-t border-hairline bg-white dark:bg-ink-950">
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16 lg:px-10">
        <div className="rounded-lg border border-hairline bg-zinc-50/70 p-5 font-mono text-[11.5px] leading-relaxed text-zinc-600 dark:bg-ink-900/50 dark:text-zinc-400">
          <div className="flex items-center justify-between border-b border-hairline pb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
            <span className="text-cyan-700 dark:text-cyan-neon">[03]</span>
            <span>git log --oneline -n 5</span>
            <span>main ↑</span>
          </div>

          <pre data-testid="footer-git-log" className="m-0 mt-3 overflow-x-auto whitespace-pre">
            {GIT_LOG.map(({ sha, message }, idx) => (
              <span key={sha}>
                <span className="text-amber-700 dark:text-amber-neon">{sha}</span> {message}
                {idx < GIT_LOG.length - 1 ? '\n' : ''}
              </span>
            ))}
          </pre>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3 text-zinc-500 dark:text-zinc-500">
            <span>
              © GETIT 9기 멘토링 — KNU · made with{' '}
              <span className="text-fuchsia-700 dark:text-magenta-neon">&lt;3</span> &amp;
              semicolons;
            </span>
            <span className="flex items-center gap-3">
              <a
                href="https://github.com/kimjhyun0627/getit-9th-mentoring"
                className="hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                github
              </a>
              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                ·
              </span>
              <a
                href="https://knu-getit.notion.site/363694c484f780ca9ef2d0feeb53503b"
                className="hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                notion
              </a>
              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                ·
              </span>
              <a
                href="mailto:hello@get-it.cloud"
                className="hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                mail
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
