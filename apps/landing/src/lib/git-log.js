import { z } from 'zod';

import { getGitLog as getBuildTimeGitLog } from '../data/git-log.js';

/**
 * #362 / #425 — GitHub Commits API 동적 fetch + cache + rate-limit graceful degradation.
 *
 * 무인증 GitHub API 는 60 req/hour per IP 제한 → 캠퍼스 NAT 환경 (12 멘티 + 4 멘토 +
 * 외부) 에서 한 IP 가 시간당 60 hit 빠르게 소진. 운영 페이지가 0% 적중 가능.
 *
 * v2 캐시 (`landing.gitlog.v2`):
 *   `{ v: 2, at: <epoch ms>, until?: <epoch ms>, items: [...] }`
 *   - `until` 있으면 그 시각까지 fetch skip + build-time fallback 강제 사용
 *     (X-RateLimit-Reset 시점까지 한산하게 휴식)
 *   - 그 외 TTL 6h 내면 캐시 반환, 만료/없으면 fetch
 *   - v1 → v2 migration: 기존 `landing.gitlog.v1` 키 무효 (Zod schema 가 reject)
 *
 * 저장소: `localStorage` (모든 탭/세션 공유). sessionStorage 는 탭 단위라
 * 캠퍼스 NAT 환경에서 무의미.
 *
 * 응답 mapping:
 *   { sha, commit: { message } } → { sha: sha.slice(0,7), message: message.split('\n')[0] }
 *
 * fail soft: fetch 실패 / 5xx / abort / JSON 파싱 실패 → build-time fallback.
 * 403 / 429 → X-RateLimit-Reset 까지 cache.until 박고 fallback.
 *
 * CR (#368): 캐시 원소도 Zod safeParse — 외부 storage 신뢰 X.
 *
 * 반환 형식은 build-time 과 동일 → Footer 가 그대로 렌더.
 */

const API_URL = 'https://api.github.com/repos/kimjhyun0627/getit-9th-mentoring/commits?per_page=5';

const CACHE_KEY = 'landing.gitlog.v2';
const COOLDOWN_KEY = 'landing.gitlog.cooldown.v2';
const LEGACY_KEY_V1 = 'landing.gitlog.v1';
const TTL_MS = 6 * 60 * 60 * 1000; // 6h (#425)

const GitLogItemSchema = z.object({
  sha: z.string().min(1),
  message: z.string().min(1),
});

const GitLogCacheSchema = z.object({
  v: z.literal(2),
  at: z.number(),
  items: z.array(GitLogItemSchema).min(1),
});

const CooldownSchema = z.object({
  v: z.literal(2),
  until: z.number(),
});

const isDev = () => {
  try {
    return Boolean(import.meta?.env?.DEV);
  } catch {
    return false;
  }
};

/* eslint-disable no-console -- DoD #425: dev-only console.debug, production 은 isDev=false 라 silent */
const devDebug = (...args) => {
  // `console.debug` 는 dev 만 활성 — production 빌드에선 `isDev()=false` 라 발화 안 함.
  if (isDev() && typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('[git-log]', ...args);
  }
};
/* eslint-enable no-console */

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const purgeLegacy = (storage) => {
  try {
    storage.removeItem(LEGACY_KEY_V1);
  } catch {
    // ignore
  }
};

const readCooldown = (storage) => {
  try {
    const raw = storage.getItem(COOLDOWN_KEY);
    if (!raw) return 0;
    const parsed = CooldownSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return 0;
    const { until } = parsed.data;
    if (Date.now() >= until) {
      try {
        storage.removeItem(COOLDOWN_KEY);
      } catch {
        // ignore
      }
      return 0;
    }
    return until;
  } catch {
    return 0;
  }
};

const writeCooldown = (storage, until) => {
  try {
    storage.setItem(COOLDOWN_KEY, JSON.stringify({ v: 2, until }));
  } catch {
    // ignore
  }
};

const readCache = () => {
  const storage = getStorage();
  if (!storage) return { items: null, blockedUntil: 0 };
  purgeLegacy(storage);
  const blockedUntil = readCooldown(storage);
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return { items: null, blockedUntil };
    const result = GitLogCacheSchema.safeParse(JSON.parse(raw));
    if (!result.success) return { items: null, blockedUntil };
    const { at, items } = result.data;
    if (Date.now() - at > TTL_MS) return { items: null, blockedUntil };
    return { items, blockedUntil };
  } catch {
    return { items: null, blockedUntil };
  }
};

const writeCache = (items) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    const payload = { v: 2, at: Date.now(), items };
    storage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage 사용 불가 (private mode, quota 등) → 캐시 없이 진행
  }
};

/**
 * X-RateLimit-Reset 헤더 (epoch seconds) → ms epoch.
 * 누락/파싱 실패 → null.
 *
 * @param {Headers | { get: (k: string) => string | null } | null | undefined} headers
 * @returns {number | null}
 */
const parseRateLimitReset = (headers) => {
  try {
    const raw = headers?.get?.('X-RateLimit-Reset');
    if (!raw) return null;
    const sec = Number(raw);
    if (!Number.isFinite(sec) || sec <= 0) return null;
    return sec * 1000;
  } catch {
    return null;
  }
};

const mapCommit = (raw) => {
  if (!raw || typeof raw.sha !== 'string' || !raw.commit) return null;
  const sha7 = raw.sha.slice(0, 7);
  const firstLine = String(raw.commit.message || '').split('\n')[0];
  if (!sha7 || !firstLine) return null;
  return { sha: sha7, message: firstLine };
};

const fallback = (reason) => {
  devDebug('fallback to build-time:', reason);
  return getBuildTimeGitLog();
};

/**
 * 5건 commits 반환. 캐시 hit → 즉시. miss → API fetch. fail → build-time fallback.
 *
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<{ sha: string; message: string }[]>}
 */
export const fetchGitLog = async ({ fetchImpl } = {}) => {
  const { items: cached, blockedUntil } = readCache();
  if (cached) return cached;
  if (blockedUntil && Date.now() < blockedUntil) {
    return fallback(`rate-limit cooldown until ${new Date(blockedUntil).toISOString()}`);
  }

  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) return fallback('no fetch impl');

  try {
    const res = await f(API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res) return fallback('no response');

    if (res.status === 403 || res.status === 429) {
      const reset = parseRateLimitReset(res.headers);
      if (reset && reset > Date.now()) {
        const storage = getStorage();
        if (storage) writeCooldown(storage, reset);
      }
      return fallback(`rate-limited status=${res.status}`);
    }

    if (!res.ok) return fallback(`status=${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return fallback('empty array');
    const mapped = data.map(mapCommit).filter(Boolean).slice(0, 5);
    if (mapped.length === 0) return fallback('no mappable commits');
    writeCache(mapped);
    return mapped;
  } catch (err) {
    return fallback(`exception: ${err?.message || err}`);
  }
};

/** 테스트 편의: 캐시 강제 무효화 (v2 + cooldown + legacy v1 모두). */
export const clearGitLogCache = () => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(CACHE_KEY);
    storage.removeItem(COOLDOWN_KEY);
    storage.removeItem(LEGACY_KEY_V1);
  } catch {
    // ignore
  }
};
