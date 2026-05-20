import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// `globals: false`라 RTL auto-cleanup이 안 걸림. 명시적으로 등록.
afterEach(() => {
  cleanup();
});

// Node 25의 실험적 `--localstorage-file` 플래그가 jsdom localStorage를
// shadow하는 충돌을 회피하기 위한 인메모리 stub (auth-web 과 동일).
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

// matchMedia stub — ThemeProvider 가 prefers-color-scheme 구독 시 호출.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
