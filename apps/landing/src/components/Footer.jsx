import { useEffect, useState } from 'react';

import { getGitLog } from '../data/git-log.js';
import { fetchGitLog } from '../lib/git-log.js';

import { ExternalLinkIcon } from './ExternalLinkIcon.jsx';

/**
 * Footer 푸터 (Tech-Dark).
 * - 1px hairline 상단 보더
 * - 박스: `[04] git log --oneline -n 5  main ↑` 헤더 + git log 5줄 + 메타 라인 (#458 — services=[01] · team=[02] · about=[03] · footer=[04])
 * - 메타 라인: copyright + github/notion 외부 링크 (mailto 제거, #296)
 *
 * #233: 초기 렌더는 빌드타임 주입된 git log 5건 (즉시 노출, CLS 없음).
 * #362: mount 후 GitHub Commits API 동적 fetch + sessionStorage 1h 캐시 → 최신 commit 반영.
 *       API fail 시 빌드타임 fallback 유지.
 * #284: 외부 링크에 `↗` 시각 인디케이터.
 * #296: 메일박스 미운영 → mailto 제거, notion이 contact 채널 역할.
 */
export const Footer = () => {
  const [gitLog, setGitLog] = useState(() => getGitLog());

  useEffect(() => {
    let cancelled = false;
    fetchGitLog()
      .then((items) => {
        if (cancelled) return;
        if (Array.isArray(items) && items.length > 0) setGitLog(items);
      })
      .catch(() => {
        // fetchGitLog 는 내부적으로 catch → fallback 반환. 안전망.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <footer className="border-t border-hairline bg-white dark:bg-ink-950">
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16 lg:px-10">
        <div className="rounded-lg border border-hairline bg-zinc-50/70 p-5 font-mono text-[11.5px] leading-relaxed text-zinc-600 dark:bg-ink-900/50 dark:text-zinc-400">
          <div className="flex items-center justify-between border-b border-hairline pb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
            <span className="text-cyan-700 dark:text-cyan-neon">[04]</span>
            <span>git log --oneline -n 5</span>
            <span>main ↑</span>
          </div>

          <pre data-testid="footer-git-log" className="m-0 mt-3 overflow-x-auto whitespace-pre">
            {gitLog.map(({ sha, message }, idx) => (
              <span key={`${sha}-${idx}`} data-testid="footer-git-log-line">
                <span className="text-amber-700 dark:text-amber-neon">{sha}</span> {message}
                {idx < gitLog.length - 1 ? '\n' : ''}
              </span>
            ))}
          </pre>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3 text-zinc-500 dark:text-zinc-500">
            <span>
              © GETIT 9기 멘토링 — KNU ·{' '}
              <span aria-hidden="true">
                made with <span className="text-fuchsia-700 dark:text-magenta-neon">&lt;3</span>{' '}
                &amp; semicolons;
              </span>
              <span className="sr-only">사랑을 담아 만들었습니다</span>
            </span>
            <span className="flex items-center gap-3">
              <a
                href="https://github.com/kimjhyun0627/getit-9th-mentoring"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                github
                <span className="sr-only"> — 새 탭에서 열림</span>
                <ExternalLinkIcon />
              </a>
              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                ·
              </span>
              <a
                href="https://knu-getit.notion.site/363694c484f780ca9ef2d0feeb53503b"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                notion
                <span className="sr-only"> — 새 탭에서 열림</span>
                <ExternalLinkIcon />
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
