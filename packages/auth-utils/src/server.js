import { JwtPayload } from '@getit/schemas/auth';
import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'getit_jwt';

/**
 * JWT 발급.
 *
 * @param {{ sub: string, email: string, name: string }} payload
 * @param {string} secret
 * @param {{ expiresIn?: string | number }} [opts]
 * @returns {string}
 */
export const signJwt = (payload, secret, opts = {}) => {
  return jwt.sign(payload, secret, { expiresIn: opts.expiresIn ?? '7d' });
};

/**
 * JWT 검증 + Zod 스키마 통과 확인.
 *
 * @param {string} token
 * @param {string} secret
 * @returns {import('@getit/schemas/auth').JwtPayloadT}
 * @throws {Error} 검증 실패 시
 */
export const verifyJwt = (token, secret) => {
  const decoded = jwt.verify(token, secret);
  const parsed = JwtPayload.safeParse(decoded);
  if (!parsed.success) {
    throw new Error('Invalid JWT payload shape');
  }
  return parsed.data;
};

/**
 * Express 미들웨어: 쿠키/Authorization 헤더의 JWT를 검증하고 req.user에 박음.
 * 검증 실패는 401.
 *
 * @param {{ secret: string, optional?: boolean }} options
 * @returns {import('express').RequestHandler}
 */
export const requireAuth = ({ secret, optional = false }) => {
  return (req, res, next) => {
    const cookieToken = req.cookies?.[COOKIE_NAME];
    const header = req.headers?.authorization;
    const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const token = cookieToken ?? bearerToken;

    if (!token) {
      if (optional) {
        req.user = null;
        return next();
      }
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      req.user = verifyJwt(token, secret);
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};
