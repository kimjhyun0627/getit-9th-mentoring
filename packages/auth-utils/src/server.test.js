import { describe, it, expect } from 'vitest';

import { signJwt, verifyJwt, requireAuth, COOKIE_NAME } from './server.js';

const SECRET = 'test-secret-min-32-chars-long-aaaaa';
const payload = { sub: 'u_1', email: 'a@b.com', name: '홍길동' };

describe('signJwt / verifyJwt', () => {
  it('서명 후 검증하면 payload 복원', () => {
    const token = signJwt(payload, SECRET);
    const decoded = verifyJwt(token, SECRET);
    expect(decoded.sub).toBe('u_1');
    expect(decoded.email).toBe('a@b.com');
    expect(decoded.name).toBe('홍길동');
  });

  it('잘못된 secret으로 검증하면 throw', () => {
    const token = signJwt(payload, SECRET);
    expect(() => verifyJwt(token, 'wrong-secret-also-long-enough-xxxxx')).toThrow();
  });

  it('만료된 토큰은 throw', () => {
    const token = signJwt(payload, SECRET, { expiresIn: -1 });
    expect(() => verifyJwt(token, SECRET)).toThrow();
  });
});

describe('requireAuth 미들웨어', () => {
  const makeReqRes = ({ cookies, headers } = {}) => {
    const req = { cookies: cookies ?? {}, headers: headers ?? {} };
    const res = {
      statusCode: 200,
      body: null,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(b) {
        this.body = b;
        return this;
      },
    };
    return { req, res };
  };

  it('쿠키 토큰 검증 통과 → req.user 세팅 + next()', () => {
    const token = signJwt(payload, SECRET);
    const { req, res } = makeReqRes({ cookies: { [COOKIE_NAME]: token } });
    let called = false;
    requireAuth({ secret: SECRET })(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(req.user.sub).toBe('u_1');
  });

  it('토큰 없으면 401', () => {
    const { req, res } = makeReqRes();
    requireAuth({ secret: SECRET })(req, res, () => {
      throw new Error('next는 호출되면 안 됨');
    });
    expect(res.statusCode).toBe(401);
  });

  it('optional 모드에서는 토큰 없어도 next() + req.user=null', () => {
    const { req, res } = makeReqRes();
    let called = false;
    requireAuth({ secret: SECRET, optional: true })(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(req.user).toBeNull();
  });

  it('Bearer 헤더로 검증 통과', () => {
    const token = signJwt(payload, SECRET);
    const { req, res } = makeReqRes({ headers: { authorization: `Bearer ${token}` } });
    let called = false;
    requireAuth({ secret: SECRET })(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(req.user.sub).toBe('u_1');
  });

  it('잘못된 토큰은 401', () => {
    const { req, res } = makeReqRes({ cookies: { [COOKIE_NAME]: 'garbage' } });
    requireAuth({ secret: SECRET })(req, res, () => {
      throw new Error('next는 호출되면 안 됨');
    });
    expect(res.statusCode).toBe(401);
  });
});
