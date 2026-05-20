/**
 * Prisma seed — 개발/테스트용 더미 책 + 서재.
 *
 * 멱등성: isbn(unique)으로 upsert. 같은 isbn이면 메타데이터만 갱신.
 * BookShelf는 (userId, bookId) unique 키로 upsert.
 *
 * 실행: `pnpm --filter @getit/shelf-api prisma:seed`
 *       또는 `pnpm --filter @getit/shelf-api exec prisma db seed`
 *
 * Note: userId는 auth-api seed의 alice/bob과 매칭되지 않을 수 있음
 *       (각 BE가 DB 분리 가정). 로컬 dev에선 더미 cuid를 사용.
 */

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const SEED_USER_ID = 'cltestuser0000000000000001';

const SEED_BOOKS = [
  {
    isbn: '9788932917245',
    title: '아몬드',
    author: '손원평',
    publisher: '창비',
    publishedAt: new Date('2017-03-31'),
    coverUrl: 'https://image.aladin.co.kr/product/11251/16/cover500/k282534274_1.jpg',
    description: '감정을 느끼지 못하는 소년이 세상과 부딪치며 성장하는 이야기.',
    source: 'manual',
  },
  {
    isbn: '9788937473135',
    title: '데미안',
    author: '헤르만 헤세',
    publisher: '민음사',
    publishedAt: new Date('2000-12-20'),
    coverUrl: 'https://image.aladin.co.kr/product/82/68/cover500/8937462281_2.jpg',
    description: '자기 자신에게로 이르는 길에 대한 이야기.',
    source: 'manual',
  },
];

const prisma = new PrismaClient();

const seedBook = async (book) => {
  const saved = await prisma.book.upsert({
    where: { isbn: book.isbn },
    update: { ...book },
    create: { ...book },
  });
  console.log(`  seeded book: ${saved.title} (isbn=${saved.isbn})`);
  return saved;
};

const seedShelfEntry = async ({ userId, bookId, status, rating, review, completedAt }) => {
  const entry = await prisma.bookShelf.upsert({
    where: { userId_bookId: { userId, bookId } },
    update: { status, rating, review, completedAt },
    create: { userId, bookId, status, rating, review, completedAt },
  });
  console.log(
    `  seeded shelf entry: user=${entry.userId} book=${entry.bookId} status=${entry.status}`,
  );
  return entry;
};

const main = async () => {
  console.log('seeding shelf-api dev data...');

  const books = [];
  for (const book of SEED_BOOKS) {
    books.push(await seedBook(book));
  }

  // 첫 번째 책: 완독 + 별점 + 감상평
  await seedShelfEntry({
    userId: SEED_USER_ID,
    bookId: books[0].id,
    status: 'READ',
    rating: 5,
    review: '담담한 문장 속에 큰 울림이 있었다. 윤재의 성장이 오래 기억에 남는다.',
    completedAt: new Date('2026-04-15'),
  });

  console.log(`done. seeded ${books.length} books + 1 shelf entry.`);
};

main()
  .catch((err) => {
    console.error('seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
