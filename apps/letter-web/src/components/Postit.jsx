import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '../lib/cn.js';
import { formatRelative, rotationFromId } from '../lib/time.js';

/**
 * 포스트잇 색상 → Tailwind background class 매핑.
 * Warm 시안의 4색 + 다크모드용 짙은 변형 (tailwind.config.js `colors.note` 와 일치).
 * Schemas `MessageColor` enum 과 1:1.
 *
 * 워시테이프 색상도 같이 묶어둬서 색마다 다른 strip 가 붙는다 (시안과 동일).
 */
const PALETTE = /** @type {const} */ ({
  PINK: { bg: 'bg-note-pink dark:bg-note-pinkDk', tape: 'bg-sage/70 dark:bg-sageW/70' },
  MINT: { bg: 'bg-note-mint dark:bg-note-mintDk', tape: 'bg-peachDk/85 dark:bg-rose/85' },
  LEMON: { bg: 'bg-note-lemon dark:bg-note-lemonDk', tape: 'bg-peachDk/85 dark:bg-rose/85' },
  LAVENDER: {
    bg: 'bg-note-lavender dark:bg-note-lavenderDk',
    tape: 'bg-sageW/70 dark:bg-sageW/60',
  },
});

/**
 * @typedef {object} Message
 * @property {string} id - 메시지 PK (cuid).
 * @property {string} content - 본문 (1~500자).
 * @property {'PINK'|'MINT'|'LEMON'|'LAVENDER'} color - 포스트잇 색상.
 * @property {string} createdAt - ISO string (BE 가 분 단위로 truncate — #250).
 * @property {boolean} is_mine - 본인 메시지 여부 (서버가 JWT 로 판단).
 *
 * NOTE (#251): `updatedAt` 은 응답에 포함되지 않음. 편집 시점 누설 → deanonymize
 * 표면이라 BE 응답에서 제거됨.
 */

/**
 * 워시테이프 위치 — ID 해시로 left/right/center 분기 (시안의 무작위 느낌, deterministic).
 *
 * @param {string} id
 * @returns {'left' | 'right' | 'center'}
 */
const tapePosition = (id) => {
  if (typeof id !== 'string' || id.length === 0) return 'center';
  const last = id.charCodeAt(id.length - 1);
  const mod = ((last % 3) + 3) % 3;
  return mod === 0 ? 'left' : mod === 1 ? 'right' : 'center';
};

/**
 * 포스트잇 카드. 시안 `docs/design/letter/warm.html` 의 `.note` 구조 1:1.
 *
 * - 익명 메시지: 본문 + 상대시간만 노출. 작성자/author 정보는 노출하지 않음.
 * - 본인 메시지(is_mine=true): "내 메시지" 워시테이프 라벨 + 편집/삭제 버튼.
 * - 회전 각도는 id 해시 기반 (-3°~+3°) — 매 리렌더에도 같은 카드는 같은 각도.
 *
 * @param {{
 *   message: Message;
 *   onEdit?: (message: Message) => void;
 *   onDelete?: (message: Message) => void;
 *   now?: Date;
 * }} props
 */
export const Postit = ({ message, onEdit, onDelete, now }) => {
  const palette = PALETTE[message.color] ?? PALETTE.LEMON;
  const rot = `${rotationFromId(message.id)}deg`;
  const tape = tapePosition(message.id);
  const confirmId = useId();
  const deleteBtnRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const confirmPrimaryRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const [confirming, setConfirming] = useState(false);

  // 확인 다이얼로그 a11y — Escape 닫기 + 자동 포커스 + 닫힐 때 삭제 버튼으로 포커스 복원.
  // Round 2 (CR id=3276028448, Gemini id=3276012497/3276012522/3276012539): inline
  // confirm 이지만 키보드 사용자에게는 모달처럼 동작해야 — Escape / autofocus / focus
  // restoration. aria-modal 은 inline (페이지 차단 X) 이라 제거 (Gemini 권고).
  useEffect(() => {
    if (!confirming) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setConfirming(false);
        deleteBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    // 다이얼로그 열리면 destructive 가 아닌 안전한 "그대로 두기" 로 초기 포커스.
    confirmPrimaryRef.current?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [confirming]);

  return (
    <article
      // 비상호작용 article 자체는 탭 동선에서 제외 (카드 N개만큼 stop 늘어남 방지).
      // hover 보정/포커스 강조는 내부 버튼 :focus-visible 과 카드의 :focus-within
      // 으로 자연스럽게 받는다.
      aria-label={message.is_mine ? '내 메시지' : undefined}
      style={{ '--rot': rot }}
      className={cn('note text-ink dark:text-mocha', palette.bg, message.is_mine && 'mine')}
    >
      <span aria-hidden="true" className={cn('washi', tape, palette.tape)} />

      {message.is_mine ? <span className="mine-badge">내 메시지</span> : null}

      <p className="text-[15px] leading-relaxed [word-break:keep-all]">{message.content}</p>

      <div className="mt-3 flex items-end justify-between gap-2">
        {/* #327 — opacity-70 → 85. 파스텔 배경(LEMON/PINK) 에서 WCAG AA 4.5:1 보장. */}
        <span className="font-hand text-base opacity-85">
          {formatRelative(message.createdAt, now)}
        </span>
        {message.is_mine ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onEdit?.(message)}
              className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white/60 px-2.5 py-1 text-xs text-ink transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-beige/25 dark:bg-mocha3/65 dark:text-beige dark:hover:bg-mocha3"
            >
              <span aria-hidden="true">✏</span> 편집
            </button>
            <button
              ref={deleteBtnRef}
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="이 쪽지 삭제"
              aria-haspopup="dialog"
              aria-controls={confirming ? confirmId : undefined}
              aria-expanded={confirming || undefined}
              className="inline-flex items-center justify-center rounded-full border border-ink/15 bg-white/60 px-2.5 py-1 text-xs text-ink transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-beige/25 dark:bg-mocha3/65 dark:text-beige dark:hover:bg-mocha3"
            >
              <span aria-hidden="true">🗑</span>
            </button>
          </div>
        ) : null}
      </div>

      {confirming ? (
        <div
          id={confirmId}
          role="dialog"
          aria-labelledby={`${confirmId}-title`}
          aria-describedby={`${confirmId}-desc`}
          className="mt-3 rounded-2xl border border-ink/10 bg-white/85 p-3 text-ink shadow-sm dark:border-beige/15 dark:bg-mocha2/90 dark:text-beige"
        >
          <p id={`${confirmId}-title`} className="text-sm font-semibold">
            이 쪽지를 떼어낼까요?
          </p>
          <p id={`${confirmId}-desc`} className="mt-1 font-hand text-sm text-ink2 dark:text-beige2">
            한 번 떼어내면 다시 붙일 수 없어요.
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              ref={confirmPrimaryRef}
              type="button"
              onClick={() => {
                setConfirming(false);
                deleteBtnRef.current?.focus();
              }}
              className="rounded-full px-3 py-1 text-xs font-medium text-ink2 transition hover:bg-cream2 dark:text-beige2 dark:hover:bg-mocha3"
            >
              그대로 두기
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onDelete?.(message);
              }}
              className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-cream shadow-sm transition hover:bg-mocha2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-beige dark:text-mocha dark:hover:bg-beige2"
            >
              떼어내기
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
};
