import { defineConfig } from 'vitest/config';

// Unit tests only; the Playwright journeys live in tests/e2e and run with `npm run test:e2e`.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Dates are built from local components, so a fixed zone keeps them deterministic.
    env: { TZ: 'UTC' },
  },
});
