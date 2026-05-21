import { Link } from 'react-router-dom';

import { HobbyLayout } from '../components/HobbyLayout.jsx';

/**
 * EditPostPage 의 로딩/에러/권한 안내 placeholder.
 * 분리 이유: EditPostPage.jsx 가 300줄 cap 안에 들어가도록.
 *
 * @param {{
 *   id: string;
 *   message: string;
 *   role?: 'status' | 'alert';
 *   tone?: 'normal' | 'error';
 *   showBack?: boolean;
 * }} props
 */
export const EditState = ({ id, message, role = 'status', tone = 'normal', showBack = false }) => (
  <HobbyLayout>
    <div className="mt-20 text-center font-round">
      <p
        role={role}
        className={
          tone === 'error'
            ? 'font-display font-bold text-rose-600 dark:text-rose-300'
            : 'font-display font-extrabold text-xl'
        }
      >
        {message}
      </p>
      {showBack ? (
        <Link
          to={`/posts/${id}`}
          className="mt-6 inline-flex items-center gap-1 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-4 py-2 text-sm font-display font-bold"
        >
          ← 모임 상세
        </Link>
      ) : null}
    </div>
  </HobbyLayout>
);
