import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// `globals: false`라 RTL auto-cleanup이 안 걸림. 명시적으로 등록.
// localStorage 도 매 테스트 후 초기화해 테스트 간 상태 누수 방지.
afterEach(() => {
  cleanup();
  window.localStorage?.clear?.();
});

// Node 25의 실험적 `--localstorage-file` 플래그가 jsdom localStorage를
// shadow하는 충돌을 회피하기 위한 인메모리 stub (auth-web과 동일).
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
