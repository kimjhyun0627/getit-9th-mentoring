import clsx from 'clsx';

/**
 * 클래스명 머지 — clsx 그대로 노출.
 * tailwind-merge 는 shelf-web에 아직 의존성 안 잡혔으니, 필요 시 추가.
 *
 * @param {...import('clsx').ClassValue} classes
 * @returns {string}
 */
export const cn = (...classes) => clsx(...classes);
