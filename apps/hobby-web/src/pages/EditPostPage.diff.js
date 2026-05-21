/**
 * PATCH diff 계산 — #431.
 *
 * EditPostPage 의 submit payload 를 변경된 필드만 담도록 줄여준다.
 *
 * 비교 규칙:
 *  - title / body / openChatUrl: 문자열 동등
 *  - capacity: Number cast 후 비교 (input 은 string)
 *  - meetAt: datetime-local 이 분 단위 정밀도라 원본의 초/ms 는 무시 (같은 분이면 unchanged)
 *  - tags: 길이 + 순서까지 같을 때만 unchanged
 *  - openChatUrl null vs '' 동일 취급 (서버는 null/string)
 *
 * @param {{
 *   title: string;
 *   body: string;
 *   meetAtLocal: string;
 *   capacity: number;
 *   openChatUrl: string;
 *   tags: string[];
 * }} values
 * @param {{
 *   title: string;
 *   body: string;
 *   meetAt: string;
 *   capacity: number;
 *   openChatUrl: string | null;
 *   tags: Array<{ name: string }>;
 * } | null} initial
 * @returns {Partial<{
 *   title: string; body: string; meetAt: string; capacity: number;
 *   openChatUrl: string; tags: string[];
 * }>}
 */
export const computePatchDiff = (values, initial) => {
  if (!initial) return {};
  /** @type {Record<string, unknown>} */
  const patch = {};
  if (values.title !== initial.title) patch.title = values.title;
  if (values.body !== initial.body) patch.body = values.body;
  const newMeetAtMs = new Date(values.meetAtLocal).getTime();
  const initialMeetAtMinuteMs = Math.floor(new Date(initial.meetAt).getTime() / 60_000) * 60_000;
  if (newMeetAtMs !== initialMeetAtMinuteMs) {
    patch.meetAt = new Date(newMeetAtMs).toISOString();
  }
  if (Number(values.capacity) !== Number(initial.capacity)) {
    patch.capacity = Number(values.capacity);
  }
  const initialOpenChat = initial.openChatUrl ?? '';
  if (values.openChatUrl !== initialOpenChat) patch.openChatUrl = values.openChatUrl;
  const initialTagNames = (initial.tags ?? []).map((t) => t.name);
  const sameTags =
    initialTagNames.length === values.tags.length &&
    initialTagNames.every((n, i) => n === values.tags[i]);
  if (!sameTags) patch.tags = values.tags;
  return patch;
};
