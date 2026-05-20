/**
 * Prisma seed — 개발/테스트용 더미 데이터.
 *
 * 멱등성: tag.upsert (by name) + 고정 ownerId 로 post.upsert 패턴.
 * - Tag 3개 (맛집/스포츠/스터디) 보장
 * - Post 1개 (auth-api seed 의 alice 가 방장)
 * - PostTag 매핑 (post × {맛집, 스터디})
 *
 * 실행: `pnpm --filter @getit/hobby-api prisma:seed`
 */

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

export const SEED_POST_ID = 'seed-post-001';
export const SEED_OWNER_ID = 'seed-user-alice';

export const SEED_TAGS = ['맛집', '스포츠', '스터디'];

export const SEED_POST = {
  id: SEED_POST_ID,
  ownerId: SEED_OWNER_ID,
  title: '오늘 18시 북문 마라탕 3명',
  body: '북문 마라탕 같이 드실 분 모집합니다. 매운맛 가능자만!',
  meetAt: new Date('2026-05-19T09:00:00Z'),
  capacity: 3,
  currentCapacity: 0,
  openChatUrl: 'https://open.kakao.com/o/seed-example',
  status: 'RECRUITING',
};

export const SEED_POST_TAGS = ['맛집', '스터디'];

export const seedTags = async (prisma) => {
  const tags = {};
  for (const name of SEED_TAGS) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    tags[name] = tag;
    console.log(`  seeded tag: ${tag.name} (id=${tag.id})`);
  }
  return tags;
};

export const seedPost = async (prisma) => {
  const post = await prisma.post.upsert({
    where: { id: SEED_POST.id },
    update: { title: SEED_POST.title, body: SEED_POST.body },
    create: SEED_POST,
  });
  console.log(`  seeded post: ${post.title} (id=${post.id})`);
  return post;
};

export const seedPostTags = async (prisma, post, tagsByName) => {
  for (const name of SEED_POST_TAGS) {
    const tag = tagsByName[name];
    if (!tag) continue;
    await prisma.postTag.upsert({
      where: { postId_tagId: { postId: post.id, tagId: tag.id } },
      update: {},
      create: { postId: post.id, tagId: tag.id },
    });
    console.log(`  linked post(${post.id}) × tag(${name})`);
  }
};

export const main = async (prisma) => {
  console.log('seeding hobby-api dev data...');
  const tagsByName = await seedTags(prisma);
  const post = await seedPost(prisma);
  await seedPostTags(prisma, post, tagsByName);
  console.log('done.');
};

// CLI 진입점일 때만 자동 실행. 테스트에서 import 시 사이드이펙트 없음.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const prisma = new PrismaClient();
  void main(prisma)
    .catch((err) => {
      console.error('seed failed:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
