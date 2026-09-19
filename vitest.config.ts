import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each workspace needs its own environment, so run them as separate
    // projects instead of globbing every test file under one root config.
    projects: [
      './frontend',
      { test: { name: 'backend', root: './backend', environment: 'node' } },
      { test: { name: 'shared', root: './packages/shared', environment: 'node' } },
    ],
  },
});
