import '@testing-library/jest-dom/vitest';

/**
 * Node 25의 실험적 `--localstorage-file` 플래그가 jsdom localStorage를
 * shadow하는 충돌이 있음 (warning: "--localstorage-file was provided without a valid path").
 * 표준 Storage API에 부합하는 인메모리 구현으로 명시적 stub.
 */
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

// jsdom은 window.matchMedia 미구현. 시스템 다크모드 감지 코드가 throw하지 않게 stub.
if (typeof window !== 'undefined' && !window.matchMedia) {
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
