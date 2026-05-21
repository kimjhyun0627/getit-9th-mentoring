import { render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInfiniteScroll } from './useInfiniteScroll.js';

/**
 * IntersectionObserver mock — observe / unobserve / disconnect 추적 +
 * trigger() 로 entry intersect 시뮬레이션.
 */
const setupObserverMock = () => {
  const instances = [];
  class MockIO {
    constructor(cb, opts) {
      this.cb = cb;
      this.opts = opts;
      this.observed = [];
      instances.push(this);
    }
    observe(el) {
      this.observed.push(el);
    }
    unobserve() {
      // no-op for test
    }
    disconnect() {
      this.observed = [];
      this.disconnected = true;
    }
    trigger(isIntersecting) {
      this.cb(this.observed.map((target) => ({ isIntersecting, target })));
    }
  }
  vi.stubGlobal('IntersectionObserver', MockIO);
  return instances;
};

/** sentinel ref 를 dom 에 attach 하는 헬퍼 컴포넌트. */
const Probe = ({ onIntersect, enabled = true, rootMargin }) => {
  const setSentinel = useInfiniteScroll({ onIntersect, enabled, rootMargin });
  const localRef = useRef(null);
  useEffect(() => {
    setSentinel(localRef.current);
    return () => setSentinel(null);
  }, [setSentinel]);
  return <div data-testid="sentinel" ref={localRef} />;
};

describe('useInfiniteScroll', () => {
  let instances;
  beforeEach(() => {
    instances = setupObserverMock();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sentinel mount 시 IntersectionObserver 가 observe 된다', () => {
    render(<Probe onIntersect={() => {}} />);
    expect(instances.length).toBe(1);
    expect(instances[0].observed.length).toBe(1);
  });

  it('sentinel 이 viewport 에 들어오면 onIntersect 가 호출된다', () => {
    const onIntersect = vi.fn();
    render(<Probe onIntersect={onIntersect} />);
    instances[0].trigger(true);
    expect(onIntersect).toHaveBeenCalledTimes(1);
  });

  it('isIntersecting=false 이면 onIntersect 가 호출되지 않는다', () => {
    const onIntersect = vi.fn();
    render(<Probe onIntersect={onIntersect} />);
    instances[0].trigger(false);
    expect(onIntersect).not.toHaveBeenCalled();
  });

  it('enabled=false 이면 observer 가 생성되지 않는다', () => {
    render(<Probe onIntersect={() => {}} enabled={false} />);
    expect(instances.length).toBe(0);
  });

  it('rootMargin 옵션이 observer 에 전달된다', () => {
    render(<Probe onIntersect={() => {}} rootMargin="500px" />);
    expect(instances[0].opts.rootMargin).toBe('500px');
  });

  it('unmount 시 observer 가 disconnect 된다', () => {
    const { unmount } = render(<Probe onIntersect={() => {}} />);
    const obs = instances[0];
    unmount();
    expect(obs.disconnected).toBe(true);
  });

  it('onIntersect 가 매 렌더 새 함수여도 observer 가 재생성되지 않는다', () => {
    const { rerender } = render(<Probe onIntersect={() => {}} />);
    const firstObserver = instances[0];
    rerender(<Probe onIntersect={() => {}} />);
    // 같은 sentinel 노드 + 같은 enabled 라면 observer 는 한 번만 만들어져야 한다.
    expect(instances.length).toBe(1);
    expect(firstObserver.disconnected).not.toBe(true);
  });
});
