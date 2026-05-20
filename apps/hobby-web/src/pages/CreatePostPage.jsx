import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { FormField, inputBaseClass } from '../components/FormField.jsx';
import { SubmitButton } from '../components/SubmitButton.jsx';
import { TagInput } from '../components/TagInput.jsx';
import { api } from '../lib/api.js';
import { useRequireAuth } from '../lib/auth.js';
import { cn } from '../lib/cn.js';

/**
 * BE PostCreateInput (`@getit/schemas/hobby`) 는 ISO 8601 meetAt 을 요구하지만,
 * 브라우저 `<input type="datetime-local">` 는 tz 가 없는 `YYYY-MM-DDTHH:mm` 만 준다.
 * → FE 폼 검증은 로컬 시각 문자열 + 별도 location 필드를 갖는 본 스키마로 진행하고,
 *   submit 단계에서 ISO 변환 + body 합성 후 BE 호출.
 *
 * location 은 BE 스키마에 별도 필드가 없으므로 body 앞에 `📍 <location>\n` 으로 prepend.
 * (서버에서 보면 그냥 본문 — 화면 라벨링은 FE 책임)
 */
const CreatePostFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, '제목 2자 이상으로 적어줘')
    .max(80, '제목이 너무 길어 (80자까지)'),
  body: z.string().trim().min(1, '본문을 적어줘').max(1800, '본문이 너무 길어 (1800자까지)'),
  // datetime-local 은 `YYYY-MM-DDTHH:mm` (tz 없음). 그대로 받고 refine 으로 미래만 통과.
  meetAtLocal: z
    .string()
    .min(1, '모임 일시를 골라줘')
    .refine((s) => !Number.isNaN(new Date(s).getTime()), {
      message: '일시 형식이 맞지 않아',
    })
    .refine((s) => new Date(s).getTime() > Date.now(), {
      message: '과거 시각은 안 돼',
    }),
  location: z.string().trim().min(1, '어디서 만날지 적어줘').max(60, '장소가 너무 길어 (60자까지)'),
  capacity: z.coerce
    .number({ invalid_type_error: '정원은 숫자로 적어줘' })
    .int('정원은 정수만')
    .min(2, '둘은 모여야지 (2명 이상)')
    .max(20, '한 번에 너무 많아 (20명까지)'),
  openChatUrl: z
    .string()
    .min(1, '카카오 오픈채팅 링크를 붙여줘')
    .max(512, '링크가 너무 길어')
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
  tags: z.array(z.string()).max(5, '태그는 5개까지').default([]),
});

/** @typedef {z.infer<typeof CreatePostFormSchema>} CreatePostFormValues */

/**
 * 모집 글 작성 페이지 (Issue #38).
 *
 * - RHF + Zod 로 클라이언트 검증 → 에러 메시지 표시
 * - submit 시 datetime-local → ISO + body prepend(location) → POST /api/posts
 * - 성공 → /posts/:id 로 이동 (react-router navigate)
 * - 401/429/500 / 검증실패 → friendly 한국어 에러
 */
export const CreatePostPage = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(/** @type {string|null} */ (null));
  // #331: 비로그인 진입 → SSO 즉시 redirect. 폼 입력 다 채우고 submit 에서야 401 받는 UX 차단.
  const { isLoading: meLoading, isLoggedIn, is401 } = useRequireAuth();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(CreatePostFormSchema),
    mode: 'onSubmit',
    defaultValues: {
      title: '',
      body: '',
      meetAtLocal: '',
      location: '',
      capacity: 4,
      openChatUrl: '',
      tags: [],
    },
  });

  /** @param {CreatePostFormValues} values */
  const onSubmit = async (values) => {
    setServerError(null);
    try {
      const meetAtIso = new Date(values.meetAtLocal).toISOString();
      const composedBody = `📍 ${values.location}\n\n${values.body}`;
      const res = await api.createPost({
        title: values.title,
        body: composedBody,
        meetAt: meetAtIso,
        capacity: values.capacity,
        openChatUrl: values.openChatUrl,
        tags: values.tags,
      });
      const postId = res?.data?.post?.id;
      if (postId) {
        navigate(`/posts/${postId}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setServerError(toFriendlyError(err));
    }
  };

  // 로그인 확인 중 / SSO redirect 진행 중에는 폼을 보여주지 않음.
  if (meLoading || (!isLoggedIn && is401)) {
    return (
      <section className="mx-auto max-w-2xl">
        <p
          role="status"
          className="mt-20 text-center font-round text-slate-500 dark:text-slate-400"
        >
          {meLoading ? '로그인 확인 중…' : '로그인 페이지로 이동 중…'}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl">
      <header className="mb-7 flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3.5 py-1.5 font-round text-xs font-bold text-rose-600 shadow-sm ring-1 ring-slate-900/5 dark:bg-white/10 dark:text-rose-300 dark:ring-white/10">
          <span aria-hidden="true">🎉</span>
          <span>새 모임 만들기</span>
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          오늘 누구랑{' '}
          <span className="bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600 bg-clip-text text-transparent dark:from-rose-300 dark:via-fuchsia-300 dark:to-violet-300">
            뭐 할까?
          </span>
        </h1>
        <p className="font-round text-sm text-slate-600 dark:text-slate-300">
          일시·장소·인원만 정해서 가볍게 올려봐. 정원 차면 오픈채팅 링크 자동 공개.
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-xl shadow-rose-100/40 sm:p-8 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/40"
        aria-label="모임 작성 폼"
      >
        <FormField
          label="제목"
          autoComplete="off"
          placeholder="예: 북문 마라탕 같이 갈 사람!"
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="post-body"
            className="font-round text-sm font-bold text-slate-800 dark:text-slate-100"
          >
            본문
          </label>
          <textarea
            id="post-body"
            rows={5}
            placeholder="모임 분위기, 준비물 같은 것도 적어줘"
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
            label="장소"
            placeholder="예: 북문 라화방"
            error={errors.location?.message}
            {...register('location')}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="정원"
            type="number"
            inputMode="numeric"
            min={2}
            max={20}
            hint="총 인원 (방장 1명 + 신청자). 예: 4 → 방장 + 신청자 3명."
            error={errors.capacity?.message}
            {...register('capacity')}
          />
          <FormField
            label="오픈채팅 링크"
            type="url"
            placeholder="https://open.kakao.com/o/..."
            hint="정원 차면 신청자에게만 공개돼. 그 전엔 아무도 못 봐."
            error={errors.openChatUrl?.message}
            {...register('openChatUrl')}
          />
        </div>

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

        <SubmitButton loading={isSubmitting}>모임 만들기 →</SubmitButton>
      </form>
    </section>
  );
};

/**
 * 서버 에러 → 사용자 친화 메시지.
 *
 * @param {unknown} err
 * @returns {string}
 */
const toFriendlyError = (err) => {
  const status = /** @type {{response?: {status?: number}}} */ (err)?.response?.status;
  if (status === 401) return '로그인이 만료됐어. 다시 로그인해줘.';
  if (status === 400 || status === 422) return '입력값을 다시 확인해줘.';
  if (status === 429) return '요청이 너무 많아. 잠시 후 다시 시도해줘.';
  if (typeof status === 'number' && status >= 500)
    return '서버에 문제가 생겼나봐. 잠시 후 다시 시도해줘.';
  return '모임을 못 올렸어. 입력을 확인하고 다시 시도해줘.';
};
