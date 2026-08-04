import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // Unit tests exercise the exported Hono app directly and do not need a
  // Miniflare inspector process. Keeping that plugin out also makes tests
  // deterministic in CI environments that route traffic through a proxy.
  plugins: [react(), ...(mode === 'test' ? [] : [cloudflare()])],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}));
