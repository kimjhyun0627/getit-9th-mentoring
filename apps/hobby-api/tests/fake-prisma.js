/**
 * hobby-api 테스트용 in-memory PrismaClient.
 *
 * 실 MySQL 없이 supertest e2e 가 돌아가도록 라우터에서 쓰는 Prisma 패턴만 흉내냄.
 *
 * 지원 모델: Tag / Post / PostTag / Application / Notification.
 * $transaction 은 FIFO mutex 로 직렬화 — MySQL InnoDB row-lock 흉내. 동시 호출이
 * 큐를 타야 race condition 테스트가 의미가 있음 (async/await 만 쓰면 interleave 돼서
 * lost-update 가 silent 통과).
 *
 * 모델 팩토리는 fake-prisma-models.js 로 분리 (파일 size cap 준수).
 */
import {
  buildApplicationModel,
  buildNotificationModel,
  buildPostModel,
  buildPostTagModel,
  buildTagModel,
} from './fake-prisma-models.js';

/**
 * @type {{
 *   tags: Map<string, any>,
 *   posts: Map<string, any>,
 *   postTags: Map<string, any>,
 *   applications: Map<string, any>,
 *   notifications: Map<string, any>,
 * }}
 */
export const memDb = {
  tags: new Map(),
  posts: new Map(),
  postTags: new Map(),
  applications: new Map(),
  notifications: new Map(),
};

let idCounter = 0;
const nextId = (prefix) => `${prefix}_${++idCounter}`;

export const resetDb = () => {
  memDb.tags.clear();
  memDb.posts.clear();
  memDb.postTags.clear();
  memDb.applications.clear();
  memDb.notifications.clear();
  idCounter = 0;
};

// $transaction 직렬화용 module-level queue (FIFO mutex).
let txQueue = Promise.resolve();

export class FakePrismaClient {
  constructor() {
    this.tag = buildTagModel(memDb, nextId);
    this.post = buildPostModel(memDb, nextId);
    this.postTag = buildPostTagModel(memDb);
    this.application = buildApplicationModel(memDb, nextId);
    this.notification = buildNotificationModel(memDb, nextId);
  }

  /**
   * 트랜잭션 직렬화 — MySQL InnoDB row-lock 흉내.
   * 단순 `fn(this)` 만 호출하면 await 경계에서 interleave 돼 race condition 테스트
   * 의미가 사라짐. FIFO 큐로 한 번에 하나만 실행 → 동시 신청 race 정확히 시뮬레이트.
   */
  async $transaction(fn) {
    if (Array.isArray(fn)) return Promise.all(fn);
    const prev = txQueue;
    let release;
    txQueue = new Promise((r) => {
      release = r;
    });
    try {
      // 이전 트랜잭션이 reject 해도 큐가 막히면 안 됨. catch 로 흡수해서 다음 tx 가 진행.
      await prev.catch(() => {});
      // 콜백 throw 시 자동 롤백 — 실 Prisma 의 `$transaction(fn)` 시멘틱.
      // memDb 스냅샷 후 실행, 예외 시 복구.
      const snapshot = {
        tags: new Map(memDb.tags),
        posts: new Map(memDb.posts),
        postTags: new Map(memDb.postTags),
        applications: new Map(memDb.applications),
        notifications: new Map(memDb.notifications),
      };
      try {
        return await fn(this);
      } catch (err) {
        memDb.tags = snapshot.tags;
        memDb.posts = snapshot.posts;
        memDb.postTags = snapshot.postTags;
        memDb.applications = snapshot.applications;
        memDb.notifications = snapshot.notifications;
        throw err;
      }
    } finally {
      release();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async $disconnect() {}

  // /api/healthz 용 — 실 Prisma 의 $queryRaw 시그니처 흉내. 인자는 무시.
  // eslint-disable-next-line class-methods-use-this
  async $queryRaw() {
    return [{ 1: 1 }];
  }
}
