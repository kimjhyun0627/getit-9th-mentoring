import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearGitLogCache, fetchGitLog } from './git-log.js';

// #362 / #425 — GitHub Commits API + localStorage 6h cache + rate-limit graceful degradation.

const CACHE_KEY = 'landing.gitlog.v2';
const COOLDOWN_KEY = 'landing.gitlog.cooldown.v2';
const LEGACY_KEY = 'landing.gitlog.v1';

const mockCommit = (sha, message) => ({
  sha,
  commit: { message },
});

const headersOf = (obj = {}) => ({
  get: (k) => (obj[k] !== undefined ? String(obj[k]) : null),
});

const okResponse = (body, headers = {}) => ({
  ok: true,
  status: 200,
  headers: headersOf(headers),
  json: async () => body,
});

const errResponse = (status, headers = {}) => ({
  ok: false,
  status,
  headers: headersOf(headers),
  json: async () => ({}),
});

describe('fetchGitLog (#362, #425)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('GitHub API 응답을 sha[:7] + message 첫 줄로 매핑한다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        okResponse([
          mockCommit('abcdef1234567890', 'feat: foo bar\n\nbody line ignored'),
          mockCommit('1234567890abcdef', 'fix: baz'),
        ]),
      );
    const items = await fetchGitLog({ fetchImpl });
    expect(items).toEqual([
      { sha: 'abcdef1', message: 'feat: foo bar' },
      { sha: '1234567', message: 'fix: baz' },
    ]);
  });

  it('최대 5건까지만 반환한다', async () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      mockCommit(`${i}aaaaaaaaaaaaaaaa`, `chore: commit ${i}`),
    );
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(many));
    const items = await fetchGitLog({ fetchImpl });
    expect(items).toHaveLength(5);
  });

  it('localStorage 6h TTL 캐시: 두 번째 호출은 fetch 안 함 (#425)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([mockCommit('abcdef1234567890', 'feat: cached')]));
    await fetchGitLog({ fetchImpl });
    await fetchGitLog({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('6h TTL 만료 시 다시 fetch 한다 (#425)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([mockCommit('abcdef1234567890', 'feat: x')]));
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await fetchGitLog({ fetchImpl });
    // 6h + 1s 이후
    vi.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 60 * 1000 + 1000);
    await fetchGitLog({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('1h 이후에도 6h 내면 캐시 적중 (#425 — sessionStorage 1h → localStorage 6h)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([mockCommit('abcdef1234567890', 'feat: x')]));
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await fetchGitLog({ fetchImpl });
    vi.spyOn(Date, 'now').mockReturnValue(now + 2 * 60 * 60 * 1000); // +2h
    await fetchGitLog({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('localStorage 에 v2 키로 저장 (#425)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([mockCommit('abcdef1234567890', 'feat: x')]));
    await fetchGitLog({ fetchImpl });
    const raw = window.localStorage.getItem(CACHE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.v).toBe(2);
    expect(parsed.items).toEqual([{ sha: 'abcdef1', message: 'feat: x' }]);
  });

  it('legacy v1 캐시는 무시되고 v1 키는 정리됨 (#425 migration)', async () => {
    window.localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        at: Date.now(),
        items: [{ sha: 'oldcafe', message: 'old cached' }],
      }),
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([mockCommit('abcdef1234567890', 'feat: fresh')]));
    const items = await fetchGitLog({ fetchImpl });
    expect(items).toEqual([{ sha: 'abcdef1', message: 'feat: fresh' }]);
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('403 + X-RateLimit-Reset → 다음 reset 까지 fetch skip + fallback (#425)', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const resetEpochSec = Math.floor(now / 1000) + 30 * 60; // 30분 뒤
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(errResponse(403, { 'X-RateLimit-Reset': resetEpochSec }));
    const items = await fetchGitLog({ fetchImpl });
    expect(items).toHaveLength(5); // build-time fallback
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // 두 번째 호출: reset 전이면 fetch skip
    vi.spyOn(Date, 'now').mockReturnValue(now + 10 * 60 * 1000); // +10분
    await fetchGitLog({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1); // skip 됨
  });

  it('429 도 같은 rate-limit 경로 (#425)', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const resetEpochSec = Math.floor(now / 1000) + 60;
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(errResponse(429, { 'X-RateLimit-Reset': resetEpochSec }));
    const items = await fetchGitLog({ fetchImpl });
    expect(items).toHaveLength(5);
    // cooldown key 에 until 박혔는지
    const parsed = JSON.parse(window.localStorage.getItem(COOLDOWN_KEY));
    expect(parsed.until).toBeGreaterThan(now);
  });

  it('rate-limit reset 시각 지나면 다시 fetch (#425)', async () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const resetEpochSec = Math.floor(now / 1000) + 60;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errResponse(403, { 'X-RateLimit-Reset': resetEpochSec }))
      .mockResolvedValueOnce(okResponse([mockCommit('abcdef1234567890', 'feat: after-reset')]));
    await fetchGitLog({ fetchImpl });
    // reset 이후
    vi.spyOn(Date, 'now').mockReturnValue(now + 120 * 1000);
    const items = await fetchGitLog({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(items).toEqual([{ sha: 'abcdef1', message: 'feat: after-reset' }]);
  });

  it('API 5xx 실패 시 build-time fallback', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errResponse(500));
    const items = await fetchGitLog({ fetchImpl });
    expect(items).toHaveLength(5);
  });

  it('API 네트워크 에러 시 build-time fallback', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const items = await fetchGitLog({ fetchImpl });
    expect(items).toHaveLength(5);
  });

  it('API 가 빈 배열 줄 때도 fallback', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse([]));
    const items = await fetchGitLog({ fetchImpl });
    expect(items).toHaveLength(5);
  });

  it('clearGitLogCache 로 캐시 무효화 가능 (v2 + v1)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([mockCommit('abcdef1234567890', 'feat: x')]));
    await fetchGitLog({ fetchImpl });
    clearGitLogCache();
    await fetchGitLog({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('오염된 캐시 (items 에 null 포함) 는 무시하고 다시 fetch 한다 (CR #368)', async () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        v: 2,
        at: Date.now(),
        items: [{ sha: 'abcdef1', message: 'feat: ok' }, null],
      }),
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([mockCommit('abcdef1234567890', 'feat: fresh')]));
    const items = await fetchGitLog({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(items).toEqual([{ sha: 'abcdef1', message: 'feat: fresh' }]);
  });

  it('잘못된 JSON 도 (`v` 누락 등) 캐시 무시 + fetch', async () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items: [] }));
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([mockCommit('abcdef1234567890', 'feat: x')]));
    await fetchGitLog({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('GitHub Commits API URL + Accept header 를 호출한다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([mockCommit('abcdef1234567890', 'feat: x')]));
    await fetchGitLog({ fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toMatch(/api\.github\.com\/repos\/kimjhyun0627\/getit-9th-mentoring\/commits/);
    expect(url).toMatch(/per_page=5/);
    expect(init.headers.Accept).toMatch(/vnd\.github/);
  });
});
