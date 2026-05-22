/**
 * Vitest 셋업 — 환경 변수 + Prisma 인메모리 모킹.
 *
 * 실 MySQL 없이 supertest로 라우터 e2e 테스트가 돌도록,
 * `src/lib/prisma.js` 가 노출하는 PrismaClient를 가짜 in-memory 구현으로 대체.
 *
 * 각 테스트 파일이 `beforeEach`에서 `resetDb()` 호출해 상태 초기화.
 */
import { beforeEach, vi } from 'vitest';

// 테스트용 환경 변수 (실 .env 안 건드림)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';
process.env.BCRYPT_COST = '4'; // 테스트 속도 (실 운영은 12)
process.env.COOKIE_DOMAIN = '';
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.PORT = '0';

/**
 * @type {{
 *   users: Map<string, any>,
 *   refreshTokens: Map<string, any>,
 *   passwordResetTokens: Map<string, any>,
 *   emailVerifyTokens: Map<string, any>,
 *   schoolVerifyTokens: Map<string, any>,
 * }}
 */
export const memDb = {
  users: new Map(),
  refreshTokens: new Map(),
  passwordResetTokens: new Map(),
  emailVerifyTokens: new Map(),
  schoolVerifyTokens: new Map(),
};

let idCounter = 0;
const nextId = (prefix) => `${prefix}_${++idCounter}`;

/** 모든 in-memory 상태 + ID 카운터 리셋 */
export const resetDb = () => {
  memDb.users.clear();
  memDb.refreshTokens.clear();
  memDb.passwordResetTokens.clear();
  memDb.emailVerifyTokens.clear();
  memDb.schoolVerifyTokens.clear();
  idCounter = 0;
};

/** Prisma where 절을 in-memory Map row 에 적용. `{ gt, gte, lt, lte, equals }` 연산자 일부 지원. */
const matchWhere = (row, where) => {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      if ('equals' in v) return row[k] === v.equals;
      if ('gt' in v) return row[k] > v.gt;
      if ('gte' in v) return row[k] >= v.gte;
      if ('lt' in v) return row[k] < v.lt;
      if ('lte' in v) return row[k] <= v.lte;
      return false;
    }
    return row[k] === v;
  });
};

/**
 * Prisma `P2002` 를 흉내내는 unique constraint 에러.
 * 실 PrismaClientKnownRequestError 와 인터페이스만 호환.
 */
class PrismaUniqueViolation extends Error {
  constructor(target) {
    super(`Unique constraint failed on the fields: ${target}`);
    this.name = 'PrismaClientKnownRequestError';
    this.code = 'P2002';
    this.meta = { target };
  }
}

class FakePrismaClient {
  constructor() {
    this.user = {
      findUnique: async ({ where }) => {
        for (const u of memDb.users.values()) if (matchWhere(u, where)) return { ...u };
        return null;
      },
      create: async ({ data }) => {
        // email/nickname/schoolEmail unique constraint 시뮬레이션 → P2002 race 케이스 검증.
        // `!= null` 로 검사 — '' 도 실제 DB unique 충돌과 동일 취급 (CR #546).
        for (const u of memDb.users.values()) {
          if (u.email === data.email) throw new PrismaUniqueViolation(['email']);
          if (data.nickname != null && u.nickname === data.nickname) {
            throw new PrismaUniqueViolation(['nickname']);
          }
          if (data.schoolEmail != null && u.schoolEmail === data.schoolEmail) {
            throw new PrismaUniqueViolation(['schoolEmail']);
          }
        }
        const id = nextId('u');
        const now = new Date();
        const row = {
          id,
          emailVerifiedAt: null,
          deletedAt: null,
          nickname: null,
          studentId: null,
          schoolEmail: null,
          schoolVerifiedAt: null,
          ...data,
          createdAt: now,
          updatedAt: now,
        };
        memDb.users.set(id, row);
        return { ...row };
      },
      update: async ({ where, data }) => {
        for (const [id, u] of memDb.users) {
          if (matchWhere(u, where)) {
            // unique constraint 검사 (email/nickname/schoolEmail 변경 시).
            if (data.email && data.email !== u.email) {
              for (const other of memDb.users.values()) {
                if (other.id !== u.id && other.email === data.email) {
                  throw new PrismaUniqueViolation(['email']);
                }
              }
            }
            if (data.nickname != null && data.nickname !== u.nickname) {
              for (const other of memDb.users.values()) {
                if (other.id !== u.id && other.nickname === data.nickname) {
                  throw new PrismaUniqueViolation(['nickname']);
                }
              }
            }
            if (data.schoolEmail != null && data.schoolEmail !== u.schoolEmail) {
              for (const other of memDb.users.values()) {
                if (other.id !== u.id && other.schoolEmail === data.schoolEmail) {
                  throw new PrismaUniqueViolation(['schoolEmail']);
                }
              }
            }
            const updated = { ...u, ...data, updatedAt: new Date() };
            memDb.users.set(id, updated);
            return { ...updated };
          }
        }
        throw new Error('User not found');
      },
    };

    this.schoolVerifyToken = {
      create: async ({ data }) => {
        for (const t of memDb.schoolVerifyTokens.values()) {
          if (t.tokenHash === data.tokenHash) throw new PrismaUniqueViolation(['tokenHash']);
        }
        const id = nextId('svt');
        const row = {
          id,
          usedAt: null,
          studentId: null,
          createdAt: new Date(),
          ...data,
        };
        memDb.schoolVerifyTokens.set(id, row);
        return { ...row };
      },
      findUnique: async ({ where }) => {
        for (const t of memDb.schoolVerifyTokens.values()) {
          if (matchWhere(t, where)) return { ...t };
        }
        return null;
      },
      update: async ({ where, data }) => {
        for (const [id, t] of memDb.schoolVerifyTokens) {
          if (matchWhere(t, where)) {
            const updated = { ...t, ...data };
            memDb.schoolVerifyTokens.set(id, updated);
            return { ...updated };
          }
        }
        throw new Error('SchoolVerifyToken not found');
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const [id, t] of memDb.schoolVerifyTokens) {
          if (matchWhere(t, where)) {
            memDb.schoolVerifyTokens.set(id, { ...t, ...data });
            count++;
          }
        }
        return { count };
      },
    };

    this.emailVerifyToken = {
      create: async ({ data }) => {
        const id = nextId('evt');
        const row = { id, usedAt: null, createdAt: new Date(), ...data };
        memDb.emailVerifyTokens.set(id, row);
        return { ...row };
      },
      findUnique: async ({ where }) => {
        for (const t of memDb.emailVerifyTokens.values()) if (matchWhere(t, where)) return { ...t };
        return null;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const [id, t] of memDb.emailVerifyTokens) {
          if (matchWhere(t, where)) {
            memDb.emailVerifyTokens.set(id, { ...t, ...data });
            count++;
          }
        }
        return { count };
      },
    };

    this.passwordResetToken = {
      create: async ({ data }) => {
        const id = nextId('prt');
        const row = { id, usedAt: null, createdAt: new Date(), ...data };
        memDb.passwordResetTokens.set(id, row);
        return { ...row };
      },
      findUnique: async ({ where }) => {
        for (const t of memDb.passwordResetTokens.values())
          if (matchWhere(t, where)) return { ...t };
        return null;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const [id, t] of memDb.passwordResetTokens) {
          if (matchWhere(t, where)) {
            memDb.passwordResetTokens.set(id, { ...t, ...data });
            count++;
          }
        }
        return { count };
      },
      deleteMany: async ({ where }) => {
        let count = 0;
        for (const [id, t] of memDb.passwordResetTokens) {
          if (matchWhere(t, where)) {
            memDb.passwordResetTokens.delete(id);
            count++;
          }
        }
        return { count };
      },
    };

    this.refreshToken = {
      create: async ({ data }) => {
        const id = nextId('rt');
        const row = { id, revokedAt: null, createdAt: new Date(), ...data };
        memDb.refreshTokens.set(id, row);
        return { ...row };
      },
      findUnique: async ({ where }) => {
        for (const t of memDb.refreshTokens.values()) if (matchWhere(t, where)) return { ...t };
        return null;
      },
      findMany: async ({ where } = {}) => {
        const out = [];
        for (const t of memDb.refreshTokens.values()) {
          if (matchWhere(t, where)) out.push({ ...t });
        }
        return out;
      },
      update: async ({ where, data }) => {
        for (const [id, t] of memDb.refreshTokens) {
          if (matchWhere(t, where)) {
            const updated = { ...t, ...data };
            memDb.refreshTokens.set(id, updated);
            return { ...updated };
          }
        }
        throw new Error('RefreshToken not found');
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const [id, t] of memDb.refreshTokens) {
          if (matchWhere(t, where)) {
            memDb.refreshTokens.set(id, { ...t, ...data });
            count++;
          }
        }
        return { count };
      },
    };
  }

  /**
   * `$transaction(fn)` interactive 형태만 지원. 배열 형태(`$transaction([p1, p2])`)는 필요 시 추가.
   * fake 환경에선 rollback 불가 — fn 이 throw 시 호출자가 일관성을 책임.
   */
  async $transaction(fn) {
    return fn(this);
  }

  // eslint-disable-next-line class-methods-use-this
  async $disconnect() {
    /* no-op */
  }
}

// `src/lib/prisma.js`가 export하는 prisma 싱글톤을 fake로 치환
vi.mock('../src/lib/prisma.js', () => {
  return { prisma: new FakePrismaClient() };
});

/**
 * Mailer mock — 테스트에선 실제 SMTP 호출 금지. sentMails 배열로 캡처.
 * 테스트가 import 해서 발송 내역을 직접 검증 가능.
 */
export const sentMails = /** @type {Array<{ to: string, subject: string, text: string }>} */ ([]);

vi.mock('../src/lib/mailer.js', () => {
  return {
    isMailerEnabled: () => false,
    __resetMailerForTests: () => {
      sentMails.length = 0;
    },
    sendPasswordResetEmail: async ({ to, resetUrl }) => {
      sentMails.push({ to, subject: 'password-reset', text: resetUrl });
    },
    sendVerifyEmail: async ({ to, verifyUrl }) => {
      sentMails.push({ to, subject: 'verify-email', text: verifyUrl });
    },
    sendSchoolVerifyEmail: async ({ to, verifyUrl }) => {
      sentMails.push({ to, subject: 'school-verify', text: verifyUrl });
    },
  };
});

beforeEach(() => {
  resetDb();
  sentMails.length = 0;
});
