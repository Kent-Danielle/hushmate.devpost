import { defineConfig } from 'prisma/config';

// Prisma 7: connection URL and seed command live here, not in schema.prisma.
// DATABASE_URL comes from the environment (compose env_file, Fly secret).
// `prisma generate` does not need a database, so fall back to an empty string
// when it is unset (e.g. the Docker build stage).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node dist/prisma/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
