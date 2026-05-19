/**
 * @typedef {object} Project
 * @property {string} eyebrow - 카드 우상단 메타 (e.g. "01")
 * @property {string} title - 한국어 프로젝트명
 * @property {string} href - 진입 URL (서브도메인)
 * @property {string} emoji - 임시 아이콘 (디자이너가 추후 교체)
 * @property {string} description - 한 줄 설명
 * @property {string} hostLabel - 카드 하단 도메인 라벨
 */

/**
 * 4 프로젝트 메타데이터.
 * Minimalist 시안의 카드 데이터를 그대로 옮겨옴.
 *
 * @type {Project[]}
 */
export const PROJECTS = [
  {
    eyebrow: '01',
    title: '취미메이트',
    href: 'https://hobby.get-it.cloud',
    emoji: '🤲',
    description: '관심사 기반 모임/소모임 매칭.',
    hostLabel: 'hobby.get-it.cloud',
  },
  {
    eyebrow: '02',
    title: '스마트 서재',
    href: 'https://shelf.get-it.cloud',
    emoji: '📚',
    description: '독서 진행도, 책 추천, 그리고 메모.',
    hostLabel: 'shelf.get-it.cloud',
  },
  {
    eyebrow: '03',
    title: '팀 칸반',
    href: 'https://board.get-it.cloud',
    emoji: '💻',
    description: '할 일 보드와 협업, 본질만.',
    hostLabel: 'board.get-it.cloud',
  },
  {
    eyebrow: '04',
    title: '익명 롤링페이퍼',
    href: 'https://letter.get-it.cloud',
    emoji: '🎤',
    description: 'GETIT 부원끼리, 익명으로 한 줄.',
    hostLabel: 'letter.get-it.cloud',
  },
];
