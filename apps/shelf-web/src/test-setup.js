import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// `globals: false`라 RTL auto-cleanup이 안 걸림. 명시적으로 등록.
afterEach(() => {
  cleanup();
  // 전역 localStorage 인스턴스 재사용 시 테스트 간 상태 누수 방지.
  window.localStorage.clear();
});

// Node 25 실험적 localstorage 충돌 회피 — 인메모리 stub.
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
