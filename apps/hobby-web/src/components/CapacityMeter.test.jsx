import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CapacityMeter } from './CapacityMeter.jsx';

describe('CapacityMeter', () => {
  it('채워진 dot 과 빈 dot 을 정확히 렌더한다', () => {
    render(<CapacityMeter currentCapacity={2} capacity={4} />);
    const meter = screen.getByTestId('capacity-meter');
    expect(meter.querySelectorAll('[data-filled="true"]').length).toBe(2);
    expect(meter.querySelectorAll('[data-filled="false"]').length).toBe(2);
    expect(meter).toHaveAttribute('aria-label', '정원 2/4');
  });

  it('capacity 가 12 초과면 progress bar (1개 filled bar) 로 폴백한다', () => {
    render(<CapacityMeter currentCapacity={5} capacity={20} />);
    const meter = screen.getByTestId('capacity-meter');
    expect(meter.querySelectorAll('[data-filled="true"]').length).toBe(1);
    expect(meter.querySelectorAll('[data-filled="false"]').length).toBe(0);
  });

  it('currentCapacity 가 capacity 를 넘어도 clamp 된다', () => {
    render(<CapacityMeter currentCapacity={99} capacity={4} />);
    const meter = screen.getByTestId('capacity-meter');
    expect(meter.querySelectorAll('[data-filled="true"]').length).toBe(4);
    expect(meter.querySelectorAll('[data-filled="false"]').length).toBe(0);
  });
});
