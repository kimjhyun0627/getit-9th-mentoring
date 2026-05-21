import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearGitLogCache, fetchGitLog } from './git-log.js';

// #362 — GitHub Commits API 동적 fetch + sessionStorage 1h 캐시 + build-time fallback.

const mockCommit = (sha, message) => ({
  sha,
  commit: { message },
});

const okResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

describe('fetchGitLog (#362)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
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

  it('최대 5건까지만 반환한다 (API 가 더 줘도 슬라이스)', async () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      mockCommit(`${i}aaaaaaaaaaaaaaaa`, `chore: commit ${i}`),
    );
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(many));
    const items = await fetchGitLog({ fetchImpl });
    expect(items).toHaveLength(5);
  });

  it('sessionStorage 1h TTL 캐시: 두 번째 호출은 fetch 안 함', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([mockCommit('abcdef1234567890', 'feat: cached')]));
    await fetchGitLog({ fetchImpl });
    await fetchGitLog({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('1h TTL 만료 시 다시 fetch 한다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([mockCommit('abcdef1234567890', 'feat: x')]));
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await fetchGitLog({ fetchImpl });
    // 1h + 1s 이후
    vi.spyOn(Date, 'now').mockReturnValue(now + 60 * 60 * 1000 + 1000);
    await fetchGitLog({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('API 5xx 실패 시 build-time fallback 5건 반환', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const items = await fetchGitLog({ fetchImpl });
    expect(items).toHaveLength(5);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
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

  it('clearGitLogCache 로 캐시 무효화 가능', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([mockCommit('abcdef1234567890', 'feat: x')]));
    await fetchGitLog({ fetchImpl });
    clearGitLogCache();
    await fetchGitLog({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('오염된 캐시 (items 에 null 포함) 는 무시하고 다시 fetch 한다 (CR #368)', async () => {
    // 누군가/다른 탭이 sessionStorage 를 `[{...}, null]` 로 오염시켰다고 가정.
    window.sessionStorage.setItem(
      'landing.gitlog.v1',
      JSON.stringify({
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

  it('잘못된 JSON 도 (`at` 누락 등) 캐시 무시 + fetch', async () => {
    window.sessionStorage.setItem('landing.gitlog.v1', JSON.stringify({ items: [] }));
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
