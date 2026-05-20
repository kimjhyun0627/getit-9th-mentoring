import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';

/**
 * 헤더의 알림 벨 + 드롭다운 (#229).
 *
 * 비로그인 (`/me` 401) 이면 아예 렌더 안 함 (props.userId 미정의).
 *
 * 데이터 흐름:
 *  - useQuery: GET /api/notifications (60s polling for unread badge)
 *  - PATCH /:id/read: 클릭 시 readAt 채움 + cache invalidate
 *  - 클릭 → /posts/:postId 로 이동 (postId 있을 때만)
 *
 * queryKey 는 `['notifications', userId]` — 사용자 변경 시 캐시 자동 분리.
 * 로그인 ↔ 로그아웃 ↔ 다른 계정 로그인 시 이전 캐시가 새 사용자에게 노출되지 않음.
 *
 * 외부 클릭 닫힘 처리는 document mousedown 리스너.
 *
 * @param {{ enabled: boolean; userId?: string | null }} props
 */
export const NotificationBell = ({ enabled, userId = null }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const queryClient = useQueryClient();

  const queryKey = ['notifications', userId ?? 'anon'];
  const notifQuery = useQuery({
    queryKey,
    queryFn: () => api.listNotifications({ limit: 20 }),
    enabled: Boolean(enabled && userId),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id) => api.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const markAll = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // 외부 클릭 시 닫기.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!enabled || !userId) return null;

  const items = notifQuery.data?.items ?? [];
  const unread = notifQuery.data?.unreadCount ?? 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `알림 ${unread}개` : '알림'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 text-slate-700 dark:text-slate-200 shadow-sm hover:scale-[1.05] transition"
      >
        <span aria-hidden="true" className="text-lg">
          🔔
        </span>
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-display font-extrabold px-1 ring-2 ring-white dark:ring-slate-900"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="알림 목록"
          className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/10 dark:ring-white/10 shadow-xl z-30"
        >
          <NotificationList
            items={items}
            isLoading={notifQuery.isLoading}
            isError={notifQuery.isError}
            onMarkRead={(id) => markRead.mutate(id)}
            onMarkAll={() => markAll.mutate()}
            markingAll={markAll.isPending}
            onItemClick={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
};

/**
 * 드롭다운 내부 리스트 + 비어있음/에러/로딩 분기.
 * NotificationBell 본체와 분리 (300줄 cap).
 *
 * @param {{
 *   items: Array<{ id: string; postId: string | null; message: string; createdAt: string; readAt: string | null }>;
 *   isLoading: boolean;
 *   isError: boolean;
 *   onMarkRead: (id: string) => void;
 *   onMarkAll: () => void;
 *   markingAll: boolean;
 *   onItemClick: () => void;
 * }} props
 */
const NotificationList = ({
  items,
  isLoading,
  isError,
  onMarkRead,
  onMarkAll,
  markingAll,
  onItemClick,
}) => {
  if (isLoading) {
    return (
      <p role="status" className="p-5 text-sm font-round text-slate-500 dark:text-slate-400">
        알림 가져오는 중…
      </p>
    );
  }
  if (isError) {
    return (
      <p role="alert" className="p-5 text-sm font-round text-rose-600 dark:text-rose-300">
        알림을 불러오지 못했어
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="p-6 text-sm text-center font-round text-slate-500 dark:text-slate-400">
        아직 알림이 없어
      </p>
    );
  }
  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <p className="text-xs font-display font-extrabold text-slate-500 dark:text-slate-400">
          알림
        </p>
        <button
          type="button"
          onClick={onMarkAll}
          disabled={markingAll}
          className="text-xs font-round font-bold text-rose-600 dark:text-rose-300 hover:underline disabled:opacity-50"
        >
          {markingAll ? '처리 중…' : '모두 읽음'}
        </button>
      </div>
      <ul aria-label="알림 항목">
        {items.map((n) => (
          <NotificationRow
            key={n.id}
            notification={n}
            onMarkRead={onMarkRead}
            onItemClick={onItemClick}
          />
        ))}
      </ul>
    </div>
  );
};

const NotificationRow = ({ notification, onMarkRead, onItemClick }) => {
  const unread = notification.readAt == null;
  const body = (
    <div
      className={cn(
        'flex flex-col gap-1 px-4 py-3 transition',
        unread
          ? 'bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100/70 dark:hover:bg-rose-500/15'
          : 'hover:bg-slate-50 dark:hover:bg-white/5',
      )}
    >
      <p className="text-sm font-round text-slate-800 dark:text-slate-100 leading-snug">
        {notification.message}
      </p>
      <p className="text-[11px] font-round text-slate-500 dark:text-slate-400">
        {new Date(notification.createdAt).toLocaleString('ko-KR')}
      </p>
    </div>
  );
  const handleClick = () => {
    if (unread) onMarkRead(notification.id);
    onItemClick();
  };
  if (notification.postId) {
    return (
      <li>
        <Link to={`/posts/${notification.postId}`} onClick={handleClick} className="block">
          {body}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <button type="button" onClick={handleClick} className="w-full text-left">
        {body}
      </button>
    </li>
  );
};
