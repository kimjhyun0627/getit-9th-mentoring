import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';

import { FormField, inputBaseClass } from '../components/FormField.jsx';
import { HobbyLayout } from '../components/HobbyLayout.jsx';
import { SubmitButton } from '../components/SubmitButton.jsx';
import { TagInput } from '../components/TagInput.jsx';
import { api } from '../lib/api.js';
import { useRequireAuth } from '../lib/auth.js';
import { cn } from '../lib/cn.js';

import { computePatchDiff } from './EditPostPage.diff.js';

/**
 * 게시글 수정 페이지 — #333.
 *
 * 흐름:
 *  - useRequireAuth → 비로그인 → SSO.
 *  - GET /api/posts/:id → 폼 prefill. 방장 아니면 (응답에 openChatUrl 없음 +
 *    me.id !== post.ownerId) "수정 불가" 안내.
 *  - PATCH /api/posts/:id 로 변경된 필드만 보냄.
 *  - 성공 → /posts/:id 로 navigate.
 */
const EditFormSchema = z.object({
  title: z.string().trim().min(2, '제목 2자 이상').max(80, '80자 이내'),
  body: z.string().trim().min(1, '본문을 적어줘').max(1800, '1800자 이내'),
  meetAtLocal: z
    .string()
    .min(1, '모임 일시를 골라줘')
    .refine((s) => !Number.isNaN(new Date(s).getTime()), { message: '일시 형식이 맞지 않아' })
    .refine((s) => new Date(s).getTime() > Date.now(), { message: '과거 시각은 안 돼' }),
  capacity: z.coerce.number().int().min(2, '2명 이상').max(20, '20명 이하'),
  openChatUrl: z
    .string()
    .min(1, '오픈채팅 링크')
    .refine(
      (v) => {
        try {
          const u = new URL(v);
          return (
            u.protocol === 'https:' &&
            u.hostname === 'open.kakao.com' &&
            u.pathname.startsWith('/o/')
          );
        } catch {
          return false;
        }
      },
      { message: '카카오 오픈채팅 링크만 돼 (https://open.kakao.com/o/...)' },
    ),
  tags: z.array(z.string()).max(5).default([]),
});

const isoToLocalInput = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const EditPostPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me, isLoading: meLoading, isLoggedIn, is401 } = useRequireAuth();
  const [serverError, setServerError] = useState(/** @type {string|null} */ (null));
  // CR review #348: prefill 은 최초 1회만. refetch 시 사용자 입력 덮어쓰지 않도록 가드.
  const didPrefillRef = useRef(false);
  // PATCH diff (#431) — 원본 post snapshot 을 보존해서 변경된 필드만 PATCH.
  const initialRef = useRef(/** @type {any} */ (null));

  const postQuery = useQuery({
    queryKey: ['post', id],
    queryFn: () => api.getPost(id),
    enabled: Boolean(id) && isLoggedIn,
    retry: false,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(EditFormSchema),
    mode: 'onSubmit',
    defaultValues: {
      title: '',
      body: '',
      meetAtLocal: '',
      capacity: 4,
      openChatUrl: '',
      tags: [],
    },
  });

  // 데이터 도착 시 폼 prefill — refetch / 캐시 갱신 때마다 reset 하지 않도록 ref 가드.
  useEffect(() => {
    const post = postQuery.data?.post;
    if (!post || didPrefillRef.current) return;
    reset({
      title: post.title,
      body: post.body,
      meetAtLocal: isoToLocalInput(post.meetAt),
      capacity: post.capacity,
      openChatUrl: post.openChatUrl ?? '',
      tags: (post.tags ?? []).map((t) => t.name),
    });
    initialRef.current = post;
    didPrefillRef.current = true;
  }, [postQuery.data, reset]);

  if (meLoading || (!isLoggedIn && is401)) {
    return (
      <HobbyLayout>
        <p role="status" className="mt-20 text-center font-round">
          {meLoading ? '로그인 확인 중…' : '로그인 페이지로 이동 중…'}
        </p>
      </HobbyLayout>
    );
  }

  if (postQuery.isLoading) {
    return (
      <HobbyLayout>
        <p role="status" className="mt-20 text-center font-round">
          모임 정보 가져오는 중…
        </p>
      </HobbyLayout>
    );
  }
  const post = postQuery.data?.post;
  if (!post) {
    return (
      <HobbyLayout>
        <p
          role="alert"
          className="mt-20 text-center font-round font-bold text-rose-600 dark:text-rose-300"
        >
          모임을 찾지 못했어.
        </p>
      </HobbyLayout>
    );
  }
  if (me && me.id !== post.ownerId) {
    return (
      <HobbyLayout>
        <div className="mt-20 text-center font-round">
          <p className="font-display font-extrabold text-xl">방장만 수정할 수 있어</p>
          <Link
            to={`/posts/${id}`}
            className="mt-6 inline-flex items-center gap-1 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-4 py-2 text-sm font-display font-bold"
          >
            ← 모임 상세
          </Link>
        </div>
      </HobbyLayout>
    );
  }
  if (post.status === 'CLOSED') {
    return (
      <HobbyLayout>
        <div className="mt-20 text-center font-round">
          <p className="font-display font-extrabold text-xl">종료된 모임은 수정할 수 없어</p>
          <Link
            to={`/posts/${id}`}
            className="mt-6 inline-flex items-center gap-1 rounded-full bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 px-4 py-2 text-sm font-display font-bold"
          >
            ← 모임 상세
          </Link>
        </div>
      </HobbyLayout>
    );
  }

  const onSubmit = async (values) => {
    setServerError(null);
    const patch = computePatchDiff(values, initialRef.current);
    // 변경 없음 → 그대로 redirect (불필요한 PATCH 안 보냄)
    if (Object.keys(patch).length === 0) {
      navigate(`/posts/${id}`, { replace: true });
      return;
    }
    try {
      await api.updatePost(id, patch);
      navigate(`/posts/${id}`, { replace: true });
    } catch (err) {
      setServerError(toFriendlyError(err));
    }
  };

  return (
    <HobbyLayout>
      <section className="mx-auto max-w-2xl">
        <Link
          to={`/posts/${id}`}
          className="inline-flex items-center gap-1 text-sm font-round font-bold text-slate-600 dark:text-slate-300"
        >
          ← 모임 상세
        </Link>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          모임 수정
        </h1>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="모임 수정 폼"
          className="mt-6 flex flex-col gap-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-xl shadow-rose-100/40 sm:p-8 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/40"
        >
          <FormField label="제목" error={errors.title?.message} {...register('title')} />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edit-body"
              className="font-round text-sm font-bold text-slate-800 dark:text-slate-100"
            >
              본문
            </label>
            <textarea
              id="edit-body"
              rows={5}
              aria-invalid={Boolean(errors.body?.message) || undefined}
              className={cn(inputBaseClass, 'min-h-[7rem] w-full resize-y px-4 py-3 text-sm')}
              {...register('body')}
            />
            {errors.body?.message ? (
              <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-300">
                {errors.body.message}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField
              label="모임 일시 (KST)"
              type="datetime-local"
              hint="한국 시간 (KST · UTC+9) 기준"
              error={errors.meetAtLocal?.message}
              {...register('meetAtLocal')}
            />
            <FormField
              label="정원"
              type="number"
              min={2}
              max={20}
              hint="총 인원 (방장 1명 + 신청자)."
              error={errors.capacity?.message}
              {...register('capacity')}
            />
          </div>
          <FormField
            label="오픈채팅 링크"
            type="url"
            hint="정원 차면 신청자에게만 공개돼."
            error={errors.openChatUrl?.message}
            {...register('openChatUrl')}
          />
          <Controller
            control={control}
            name="tags"
            render={({ field, fieldState }) => (
              <TagInput
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />

          {serverError ? (
            <p
              role="alert"
              className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-200"
            >
              {serverError}
            </p>
          ) : null}

          <SubmitButton loading={isSubmitting}>저장</SubmitButton>
        </form>
      </section>
    </HobbyLayout>
  );
};

const toFriendlyError = (err) => {
  const status = err?.response?.status;
  const code = err?.response?.data?.error;
  if (status === 401) return '로그인이 만료됐어. 다시 로그인해줘.';
  if (status === 403) return '방장만 수정할 수 있어.';
  if (status === 422 && code === 'CapacityBelowApplicants')
    return '이미 신청한 사람보다 정원을 낮출 수 없어.';
  if (status === 422 && code === 'PostClosed') return '종료된 모임은 수정할 수 없어.';
  if (status === 400) return '입력값을 다시 확인해줘.';
  if (status === 429) return '요청이 너무 많아. 잠시 후 다시 시도해줘.';
  return '저장에 실패했어. 잠시 후 다시 시도해줘.';
};
