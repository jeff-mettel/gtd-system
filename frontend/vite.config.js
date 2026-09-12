import { defineConfig } from 'vite';

export default defineConfig({
  base: './',                      // relative asset URLs: the artifact host serves no root-relative paths
  build: { outDir: 'dist', sourcemap: true, target: 'es2022' },
  server: { port: 5173, open: false },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
