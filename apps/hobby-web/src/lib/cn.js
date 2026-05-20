import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind class 병합 헬퍼 (clsx + tailwind-merge).
 *
 * @param {...import('clsx').ClassValue} inputs
 * @returns {string}
 */
export const cn = (...inputs) => twMerge(clsx(inputs));
