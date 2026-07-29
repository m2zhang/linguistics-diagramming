/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    proxy: {
      // The Express API (server/) runs separately on PORT (default 4000, see
      // server/.env.example). Proxying here lets the frontend call relative
      // /api/... paths in dev, matching how they'll resolve in production
      // when both are served from the same origin.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
