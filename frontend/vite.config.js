import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const ledger = fileURLToPath(new URL('../packages/ledger/index.js', import.meta.url));

export default defineConfig({
  base: './',                      // relative asset URLs: the artifact host serves no root-relative paths
  resolve: { alias: { '@snowball/ledger': ledger } },   // the shared ledger package, one directory up
  build: { outDir: 'dist', sourcemap: true, target: 'es2022' },
  server: {
    port: 5173, open: false,
    fs: { allow: ['..'] },        // serve ../packages/ledger in dev
    /* `npm run dev` talks to a ledger server on :4310 when one is running (server/ or packages/ledger/scripts/devserver.js);
       when it is not, /api/health fails and the store falls back to the local (browser) ledger. */
    proxy: { '/api': { target: process.env.SNOW_SERVER || 'http://localhost:4310', changeOrigin: true } },
  },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
