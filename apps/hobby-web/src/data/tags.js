/**
 * 필터 칩 사전 정의 (시안 1:1).
 * - 시간 필터: 오늘 / 이번주 (클라이언트에서 meetAt 으로 필터)
 * - 태그 필터: 서버 query 의 `tag` 파라미터로 전달 (단일 선택)
 *
 * `key` 는 서버 계약과 동일한 한국어 태그 이름 — `GET /api/posts?tag=` 로
 * 그대로 전달된다 (BE 는 trim + lowercase 정규화 후 매칭).
 * `label` 은 UI 표시용 (현재는 key 와 동일하지만, 향후 분기 가능).
 */

/** @type {Array<{ key: string; label: string; emoji: string; tone: string }>} */
export const TAG_CHIPS = [
  {
    key: '맛집',
    label: '맛집',
    emoji: '🍽',
    tone: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-200',
  },
  {
    key: '스포츠',
    label: '스포츠',
    emoji: '⚽',
    tone: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-200',
  },
  {
    key: '스터디',
    label: '스터디',
    emoji: '🧠',
    tone: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-200',
  },
  {
    key: '보드게임',
    label: '보드게임',
    emoji: '🎲',
    tone: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200',
  },
  {
    key: '카페',
    label: '카페',
    emoji: '☕',
    tone: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-200',
  },
];

/** @type {Array<{ key: 'all' | 'today' | 'week'; label: string; emoji: string }>} */
export const TIME_CHIPS = [
  { key: 'all', label: '전체', emoji: '🔥' },
  { key: 'today', label: '오늘', emoji: '🌞' },
  { key: 'week', label: '이번주', emoji: '🗓' },
];
