/**
 * @typedef {'cyan' | 'magenta' | 'lime' | 'amber'} ProjectAccent
 */

/**
 * @typedef {object} Project
 * @property {string} eyebrow - 카드 좌상단 인덱스 (e.g. "[01]")
 * @property {string} idLabel - 카드 우상단 trace ID (e.g. "ID: HBY-01")
 * @property {string} slug - 영문 슬러그 (UPPERCASE 카드 헤더용)
 * @property {string} subtitle - 영문 부제 (e.g. "hobbymate · matchmaking")
 * @property {string} title - 한국어 프로젝트명
 * @property {string} href - 진입 URL (서브도메인)
 * @property {string} emoji - 임시 아이콘 (디자이너가 추후 교체)
 * @property {string} description - 한 줄 설명
 * @property {string} hostLabel - 카드 하단 도메인 라벨
 * @property {ProjectAccent} accent - 네온 액센트 (CSS card-tech[data-accent])
 */

/**
 * 4 프로젝트 메타데이터.
 * Tech-Dark 시안: 카드별 액센트 네온 4종 분배 + trace ID 메타.
 *
 * @type {Project[]}
 */
export const PROJECTS = [
  {
    eyebrow: '[01]',
    idLabel: 'ID: HBY-01',
    slug: 'HOBBY',
    subtitle: 'hobbymate · matchmaking',
    title: '취미메이트',
    href: 'https://hobby.get-it.cloud',
    emoji: '🤲',
    description: '관심사 기반 모임/소모임 매칭. 위치 · 관심사 · 시간대 알고리즘.',
    hostLabel: 'hobby.get-it.cloud',
    accent: 'cyan',
  },
  {
    eyebrow: '[02]',
    idLabel: 'ID: SHF-02',
    slug: 'SHELF',
    subtitle: 'smart-shelf · library',
    title: '스마트 서재',
    href: 'https://shelf.get-it.cloud',
    emoji: '📚',
    description: '개인 도서 컬렉션과 독서 기록. OCR 책 스캔, 추천 알고리즘.',
    hostLabel: 'shelf.get-it.cloud',
    accent: 'magenta',
  },
  {
    eyebrow: '[03]',
    idLabel: 'ID: BRD-03',
    slug: 'BOARD',
    subtitle: 'kanban · realtime',
    title: '팀 칸반',
    href: 'https://board.get-it.cloud',
    emoji: '💻',
    description: '실시간 협업 칸반 보드. WebSocket 동기화, 드래그 · 드롭.',
    hostLabel: 'board.get-it.cloud',
    accent: 'lime',
  },
  {
    eyebrow: '[04]',
    idLabel: 'ID: LTR-04',
    slug: 'LETTER',
    subtitle: 'letter · anonymous',
    title: '익명 롤링페이퍼',
    href: 'https://letter.get-it.cloud',
    emoji: '🎤',
    description: 'GETIT 부원끼리, 익명으로 한 줄. 모더레이션 + 공유 링크.',
    hostLabel: 'letter.get-it.cloud',
    accent: 'amber',
  },
];
