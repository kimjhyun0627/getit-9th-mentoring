/**
 * notification messages 카피 일관성 테스트 — #437.
 */
import { describe, expect, it } from 'vitest';

import {
  matchFullMessage,
  noShowReportedMessage,
  postClosedMessage,
} from '../src/lib/notificationMessages.js';

describe('notification messages — Playful 톤 일관성', () => {
  it('matchFullMessage: 제목 + 잔치 이모지 + 반말', () => {
    const m = matchFullMessage('북문 마라탕');
    expect(m).toContain('「북문 마라탕」');
    expect(m).toContain('🎉');
    expect(m).toContain('마감됐어');
    expect(m).not.toContain('요.');
  });

  it('postClosedMessage: 종료 안내 반말', () => {
    const m = postClosedMessage('스터디 모임');
    expect(m).toBe('「스터디 모임」 모집이 종료됐어.');
  });

  it('noShowReportedMessage: 노쇼 신고 반말', () => {
    const m = noShowReportedMessage('마라탕');
    expect(m).toContain('「마라탕」');
    expect(m).toContain('노쇼로 신고했어');
    expect(m).not.toContain('했어요');
  });

  it('title 없을 때도 깨지지 않음', () => {
    expect(matchFullMessage(undefined)).not.toContain('undefined');
    expect(postClosedMessage('')).not.toContain('「」');
  });

  it('모든 메시지 마침표 / 이모지 일관 — -요 종결어미 없음', () => {
    for (const m of [matchFullMessage('t'), postClosedMessage('t'), noShowReportedMessage('t')]) {
      expect(m).not.toMatch(/요\.$/);
    }
  });
});
