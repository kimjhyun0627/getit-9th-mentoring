/**
 * Prisma schema 검증 — DB 연결 없이 schema.prisma 파일 자체의 구조를 본다.
 *
 * #45 (DBA 단독 PR)에선 라우터/핸들러가 없어서 supertest 통합 테스트가 아직 없음.
 * 후속 #46/#47/#48에서 Express 라우트 추가 시 supertest 기반 통합 테스트가 들어온다.
 * 그때까진 schema가 깨지지 않게 이 스모크 테스트로 가드만 친다.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '..', 'prisma', 'schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');

describe('board-api Prisma schema', () => {
  it('declares 4 core models (User는 auth-api 공유)', () => {
    for (const model of ['Project', 'ProjectMember', 'BoardColumn', 'Card']) {
      expect(schema).toMatch(new RegExp(`model ${model} \\{`));
    }
  });

  it('enum MemberRole has OWNER and MEMBER', () => {
    expect(schema).toMatch(/enum MemberRole \{[\s\S]*OWNER[\s\S]*MEMBER[\s\S]*\}/);
  });

  it('cascade delete: ProjectMember/BoardColumn/Card all reference parent with onDelete: Cascade', () => {
    const cascadeCount = (schema.match(/onDelete:\s*Cascade/g) ?? []).length;
    expect(cascadeCount).toBeGreaterThanOrEqual(3);
  });

  it('order indexes include id as deterministic tie-breaker (between-keys 동률 보호)', () => {
    expect(schema).toMatch(/@@index\(\[projectId, order, id\]\)/);
    expect(schema).toMatch(/@@index\(\[columnId, order, id\]\)/);
  });

  it('order columns are Float (between-keys 알고리즘 전제)', () => {
    expect(schema).toMatch(/order\s+Float/);
  });
});
