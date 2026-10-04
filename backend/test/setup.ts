// e2e helpers and global setup. Import this file FIRST in every e2e spec: it points the
// app at the hushmate_test database before any app module reads the config.
import { execSync } from 'node:child_process';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error('TEST_DATABASE_URL is required for e2e tests');
if (new URL(testUrl).pathname !== '/hushmate_test') {
  throw new Error('TEST_DATABASE_URL must point at the hushmate_test database');
}
process.env.DATABASE_URL = testUrl;
process.env.SCHEDULER_ENABLED = 'false';

export const TEST_JWT_SECRET = process.env.JWT_SECRET as string;

/** Vitest globalSetup: runs once per `npm run test:e2e`, resets the test database to the migrations. */
export function setup(): void {
  execSync('npx prisma migrate reset --force', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}

/** Builds the app through the same configureApp() main.ts uses. */
export async function createTestApp(): Promise<INestApplication> {
  const { AppModule } = await import('../src/app.module.js');
  const { configureApp } = await import('../src/configure-app.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

/** Empties every table (called once per file, in beforeAll). */
export async function truncateAll(app: INestApplication): Promise<void> {
  const { PrismaService } = await import('../src/prisma/prisma.service.js');
  const prisma = app.get(PrismaService);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
