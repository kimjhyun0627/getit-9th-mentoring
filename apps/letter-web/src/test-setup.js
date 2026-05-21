import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// `globals: false`라 RTL auto-cleanup이 안 걸림. 명시적으로 등록.
// memoryStorage() 인스턴스가 전역으로 공유되니까 테스트 간 오염을 막기 위해
// localStorage.clear() 도 같이 호출 — CR 가이드 #55 round 1.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  // theme cookie sync (PR #376) — 테스트 간 오염 방지로 모든 쿠키 expire.
  const all = document.cookie ? document.cookie.split(';') : [];
  for (const part of all) {
    const k = part.split('=')[0]?.trim();
    if (k) document.cookie = `${k}=; Max-Age=0; Path=/`;
  }
});

// Node 25의 실험적 `--localstorage-file` 플래그가 jsdom localStorage를
// shadow하는 충돌을 회피하기 위한 인메모리 stub (auth-web / hobby-web 와 동일).
const memoryStorage = () => {
  let store = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    key(i) {
      return Object.keys(store)[i] ?? null;
    },
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setItem(k, v) {
      store[k] = String(v);
    },
    removeItem(k) {
      delete store[k];
    },
    clear() {
      store = {};
    },
  };
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  writable: true,
  value: memoryStorage(),
});
