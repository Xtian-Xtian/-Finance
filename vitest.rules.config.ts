import { defineConfig } from 'vitest/config'

// Security Rules tests — run against the Firestore emulator via `npm run test:rules`.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
})
