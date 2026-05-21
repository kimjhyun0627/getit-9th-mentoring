import { describe, expect, it } from 'vitest';

import { resolveBootstrapTheme } from './theme-bootstrap.js';

/**
 * #414 — 무플래시 부트스트랩이 OS system 선호도를 따르도록.
 * 4 경로: saved=light / dark / system / null × matchMedia matches true/false.
 */

const makeStorage = (value) => ({
  getItem: () => value,
});

const makeWindow = (matches) => ({
  matchMedia: () => ({ matches }),
});

describe('resolveBootstrapTheme (#414)', () => {
  it("saved='dark' 면 matchMedia 무시하고 dark", () => {
    expect(
      resolveBootstrapTheme({
        storage: makeStorage('dark'),
        window: makeWindow(false), // light OS 인데도
      }),
    ).toBe('dark');
  });

  it("saved='light' 면 matchMedia 무시하고 light", () => {
    expect(
      resolveBootstrapTheme({
        storage: makeStorage('light'),
        window: makeWindow(true), // dark OS 인데도
      }),
    ).toBe('light');
  });

  it("saved='system' + OS dark → dark", () => {
    expect(
      resolveBootstrapTheme({
        storage: makeStorage('system'),
        window: makeWindow(true),
      }),
    ).toBe('dark');
  });

  it("saved='system' + OS light → light (FOUC 회피 핵심)", () => {
    expect(
      resolveBootstrapTheme({
        storage: makeStorage('system'),
        window: makeWindow(false),
      }),
    ).toBe('light');
  });

  it('saved=null + OS dark → dark (첫 방문자)', () => {
    expect(
      resolveBootstrapTheme({
        storage: makeStorage(null),
        window: makeWindow(true),
      }),
    ).toBe('dark');
  });

  it('saved=null + OS light → light (라이트 OS 첫 방문자 깜빡임 방지)', () => {
    expect(
      resolveBootstrapTheme({
        storage: makeStorage(null),
        window: makeWindow(false),
      }),
    ).toBe('light');
  });

  it('matchMedia 미지원 환경 → dark fallback (Tech-Dark 기본)', () => {
    expect(
      resolveBootstrapTheme({
        storage: makeStorage(null),
        window: {}, // matchMedia 없음
      }),
    ).toBe('dark');
  });

  it('storage 가 throw 해도 dark fallback', () => {
    expect(
      resolveBootstrapTheme({
        storage: {
          getItem: () => {
            throw new Error('SecurityError');
          },
        },
        window: makeWindow(false),
      }),
    ).toBe('dark');
  });

  it('deps 없이 호출해도 죽지 않고 dark fallback', () => {
    expect(resolveBootstrapTheme()).toBe('dark');
  });
});
