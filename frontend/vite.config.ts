import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Read VITE_* variables from the root .env shared with docker compose.
  envDir: '..',
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    name: 'frontend',
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
