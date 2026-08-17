/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Where the app is served from. Root during development; set VITE_BASE_PATH
  // when building for a subpath host:
  //
  //   VITE_BASE_PATH=/~you/syntaxtree/ npm run build
  //
  // It must be an absolute path with a trailing slash. A relative base ('./',
  // which this used to be) cannot work alongside BrowserRouter: on a nested
  // route such as /courses/<id>/lectures a reload resolves './assets/app.js'
  // against that route rather than against the app, so every asset 404s and
  // the page comes up blank.
  //
  // The same value reaches the client as import.meta.env.BASE_URL, which feeds
  // the router basename and appUrl(), so this one variable is the single place
  // the deploy path is configured.
  const base = loadEnv(mode, process.cwd(), '').VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [react(), tailwindcss()],
    test: {
      globals: true,
      environment: 'jsdom',
    },
  };
});
