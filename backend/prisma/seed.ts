// Standalone seed: never boots the Nest app (no timers). `npm run seed`.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { resetDemoContent, upsertDemoWorld } from '../src/demo/demo-data.js';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (!process.env.DEMO_ACCOUNT_PASSWORD) throw new Error('DEMO_ACCOUNT_PASSWORD is not set');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await upsertDemoWorld(prisma);
    // The guard makes this the initial content reset on a fresh database and a no-op after.
    const ran = await resetDemoContent(prisma);
    console.log(ran ? 'Demo world seeded and content reset.' : 'Demo world up to date (content reset already done today).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
