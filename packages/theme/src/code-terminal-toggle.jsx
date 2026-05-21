import { useEffect } from 'react';

import { useTheme } from './store.js';

/**
 * Tech-Dark 페르소나 (landing + auth) 전용 다크 토글 — "code terminal" 메타포.
 *
 * 시안: docs/design/landing-auth/code-terminal-toggle.html
 *
 * 외관 (모노 폰트 JetBrains Mono):
 *  - `>` prompt (zinc) + `theme` 키워드 (cyan) + `[ light ]`/`[ dark ]` 값 + cyan 깜빡임 caret
 *  - 라이트: 흰 카드 + zinc 텍스트, cyan-700 액센트
 *  - 다크: ink-900 카드 + zinc-200 텍스트, cyan-neon (#22d3ee) 액센트
 *  - hairline 보더 + hover 시 cyan border + 미세 글로우
 *
 * 동작:
 *  - 클릭 → `useTheme.toggle()` (`@getit/theme` store 공유, 다른 4 앱과 sync)
 *  - 값 텍스트는 항상 7-char 폭 (`[ light ]` / `[ dark  ]`) — 폭 jitter 방지
 *  - caret 은 글로벌 `.caret` (landing/auth index.css) 또는 fallback 인젝션
 *
 * a11y:
 *  - `role="switch"` + `aria-checked` (다크 = true)
 *  - 고정 `aria-label` ("다크 모드 토글 (terminal)") — 상태 변화는 aria-checked 담당
 *  - 키보드: button + role=switch (Space/Enter 기본 동작)
 *  - WCAG AA: 라이트 zinc-700/배경 흰 7:1, 다크 zinc-200/ink-900 11:1, cyan 액센트 4.5:1↑
 *
 * 모션:
 *  - caret blink 1.05s (기존 .caret 키프레임 재사용)
 *  - hover scale/glow 180ms transition
 *  - `prefers-reduced-motion: reduce` 면 caret 정적 + transition 제거
 *    (글로벌 reduced-motion 룰이 .caret 처리 — 추가 보장 위해 컴포넌트 스타일에도 명시)
 *
 * @param {{ className?: string }} props
 */
export const CodeTerminalToggle = ({ className }) => {
  const resolved = useTheme((s) => s.resolved);
  const toggle = useTheme((s) => s.toggle);
  const isDark = resolved === 'dark';

  // 다른 앱 (shelf/board 등) 에서도 안전하게 동작하도록 .caret 키프레임 fallback 1회 주입.
  // landing/auth 는 index.css 에 이미 정의 — 중복 정의는 동일 셀렉터라 무해.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('getit-code-terminal-toggle-styles')) return;
    const style = document.createElement('style');
    style.id = 'getit-code-terminal-toggle-styles';
    style.textContent = `
      .ct-caret {
        display: inline-block;
        width: 0.55ch;
        height: 1em;
        background: currentColor;
        animation: ct-blink 1.05s steps(1) infinite;
        margin-left: 0.12em;
        vertical-align: -0.12em;
      }
      @keyframes ct-blink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .ct-caret { animation: none; opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // 값 텍스트 — 폭 일정화 (라이트 7글자 [ light ], 다크 7글자 [ dark  ])
  const valueText = isDark ? '[ dark  ]' : '[ light ]';

  // bg 알파를 0.7 → 0.92 로 올려 dark scene 위 텍스트 contrast 안정화 (#371).
  const baseClass =
    'group inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-2.5 font-mono text-[11px] leading-none transition focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-700 dark:focus-visible:outline-cyan-neon';

  const themeColors =
    'bg-white/90 text-zinc-700 hover:border-cyan-700 hover:text-cyan-700 dark:bg-ink-900/92 dark:text-zinc-100 dark:hover:border-cyan-neon';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="다크 모드 토글 (terminal)"
      onClick={toggle}
      data-theme={isDark ? 'dark' : 'light'}
      className={className ?? `${baseClass} ${themeColors}`}
    >
      <span aria-hidden="true" className="text-zinc-500 dark:text-zinc-400">
        &gt;
      </span>
      <span aria-hidden="true" className="text-cyan-700 dark:text-cyan-neon">
        theme
      </span>
      {/*
        값 텍스트 (#377 fix):
        - 라이트: zinc-900 (#18181b) on white/90 → 17.4:1 (AAA)
        - 다크:   white (#ffffff) on ink-900/92 → 18.5:1 (AAA, 최대 contrast)
          이전 cyan-300 은 (1) Tailwind purge 가 packages/theme src 를 scan 안 해서
          landing/auth 빌드 CSS 에서 클래스 자체가 삭제됨 + (2) cyan caret 과 색이
          겹쳐 시선 분리도 약했음. white 로 단순화 + 캐럿/keyword cyan 과 색 분리.
        whitespace-pre + tabular-nums 로 폭 jitter 방지 유지.
      */}
      <span
        aria-hidden="true"
        className="whitespace-pre tabular-nums text-zinc-900 dark:text-white"
      >
        {valueText}
      </span>
      <span aria-hidden="true" className="ct-caret text-cyan-700 dark:text-cyan-neon" />
    </button>
  );
};
