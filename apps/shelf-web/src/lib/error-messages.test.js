import { describe, expect, it } from 'vitest';

import {
  addBookError,
  bookError,
  searchError,
  shelfError,
  userShelfError,
} from './error-messages.js';

const make = (status) => ({ response: { status } });

describe('error-messages — Editorial 격식 톤 통일', () => {
  it('shelfError 는 401/404/422/500/fallback 을 격식체로 매핑', () => {
    expect(shelfError(make(401))).toContain('로그인이 필요합니다');
    expect(shelfError(make(404))).toContain('찾을 수 없습니다');
    expect(shelfError(make(422))).toContain('이미 서가에');
    expect(shelfError(make(503))).toContain('펼칠 수 없습니다');
    expect(shelfError(new Error('weird'))).toContain('불러오지 못했습니다');
  });

  it('bookError 는 404/400/500 책 메타포 격식체', () => {
    expect(bookError(make(404))).toBe('그 책은 이 서가에 없습니다.');
    expect(bookError(make(400))).toContain('잘못된 ISBN');
    expect(bookError(make(503))).toContain('책장에 손이 닿지 않습니다');
    expect(bookError(undefined)).toContain('펼치지 못했습니다');
  });

  it('addBookError 는 SearchPage/BookDetail 공용', () => {
    expect(addBookError(make(422))).toContain('이미 서가에');
    expect(addBookError(make(401))).toContain('로그인이 필요');
    expect(addBookError(make(500))).toContain('잠시 후 다시 담아');
    expect(addBookError({})).toContain('실패했습니다');
  });

  it('searchError 503/400/fallback', () => {
    expect(searchError(make(503))).toContain('잠시 후 다시 펼쳐');
    expect(searchError(make(400))).toContain('검색어를 다시');
    expect(searchError(null)).toContain('검색 중 문제가 생겼습니다');
  });

  it('userShelfError 는 400/404/500 격식 + 도서관 메타포', () => {
    expect(userShelfError(make(400))).toContain('잘못된 사용자 주소');
    expect(userShelfError(make(404))).toContain('이 도서관에 없습니다');
    expect(userShelfError(make(503))).toContain('펼칠 수 없습니다');
    expect(userShelfError(null)).toContain('불러오지 못했습니다');
  });

  it('어떤 함수든 반말 종결어미가 등장하지 않는다', () => {
    // 반말 종결: ~예요/~어요/~네요/~지요 등 — Editorial 위배.
    const samples = [
      shelfError(make(404)),
      bookError(undefined),
      addBookError({}),
      searchError(make(400)),
      userShelfError(make(404)),
    ];
    for (const s of samples) {
      expect(s).not.toMatch(/(예요|어요|네요|지요)\.?$/);
    }
  });
});
