import { z } from 'zod';

import { getGitLog as getBuildTimeGitLog } from '../data/git-log.js';

/**
 * #362 — GitHub Commits API 동적 fetch + sessionStorage 1h 캐시 + build-time fallback.
 *
 * 무인증 GitHub API 는 60 req/hour per IP 제한 → 캐시 필수.
 *  - sessionStorage `landing.gitlog.v1` : `{ at: <epoch ms>, items: [...] }`
 *  - TTL 1h 내면 캐시 반환, 만료/없으면 fetch
 *  - fetch 실패 / 5xx / abort / JSON 파싱 실패 → build-time fallback (data/git-log.js)
 *
 * 응답 mapping:
 *   { sha, commit: { message } } → { sha: sha.slice(0,7), message: message.split('\n')[0] }
 *
 * CR (#368): 캐시 원소도 Zod 로 schema validate. 외부 storage 신뢰 X — 다른 탭/
 * 확장 프로그램이 `[{...}, null]` 같은 형태로 오염시키면 Footer 의 구조분해에서
 * TypeError. projects.js / useSession.js 패턴 따라 safeParse 사용.
 *
 * 반환 형식은 build-time 과 동일 → Footer 가 그대로 렌더할 수 있게.
 */

const API_URL = 'https://api.github.com/repos/kimjhyun0627/getit-9th-mentoring/commits?per_page=5';

const CACHE_KEY = 'landing.gitlog.v1';
const TTL_MS = 60 * 60 * 1000; // 1 hour

const GitLogItemSchema = z.object({
  sha: z.string().min(1),
  message: z.string().min(1),
});

const GitLogCacheSchema = z.object({
  at: z.number(),
  items: z.array(GitLogItemSchema).min(1),
});

const readCache = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const result = GitLogCacheSchema.safeParse(JSON.parse(raw));
    if (!result.success) return null;
    if (Date.now() - result.data.at > TTL_MS) return null;
    return result.data.items;
  } catch {
    return null;
  }
};

const writeCache = (items) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
  } catch {
    // sessionStorage 사용 불가 (private mode, quota 등) → 캐시 없이 진행
  }
};

const mapCommit = (raw) => {
  if (!raw || typeof raw.sha !== 'string' || !raw.commit) return null;
  const sha7 = raw.sha.slice(0, 7);
  const firstLine = String(raw.commit.message || '').split('\n')[0];
  if (!sha7 || !firstLine) return null;
  return { sha: sha7, message: firstLine };
};

/**
 * 5건 commits 반환. 캐시 hit → 즉시. miss → API fetch. fail → build-time fallback.
 *
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<{ sha: string; message: string }[]>}
 */
export const fetchGitLog = async ({ fetchImpl } = {}) => {
  const cached = readCache();
  if (cached) return cached;

  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) return getBuildTimeGitLog();

  try {
    const res = await f(API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res || !res.ok) return getBuildTimeGitLog();
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return getBuildTimeGitLog();
    const mapped = data.map(mapCommit).filter(Boolean).slice(0, 5);
    if (mapped.length === 0) return getBuildTimeGitLog();
    writeCache(mapped);
    return mapped;
  } catch {
    return getBuildTimeGitLog();
  }
};

/** 테스트 편의: 캐시 강제 무효화. */
export const clearGitLogCache = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
};
