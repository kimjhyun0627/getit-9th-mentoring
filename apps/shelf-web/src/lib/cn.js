import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind 클래스 병합 헬퍼 (shadcn 표준).
 *
 * @param  {...any} inputs
 * @returns {string}
 */
export const cn = (...inputs) => twMerge(clsx(inputs));
