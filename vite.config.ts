import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Frontend bor i web/. I dev proxas /ws och /api till Node-servern på 3000.
// I produktion bygger vi till web/dist och Node-servern levererar de filerna.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(process.cwd(), 'shared'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
      '/api': 'http://localhost:3000',
    },
  },
});
