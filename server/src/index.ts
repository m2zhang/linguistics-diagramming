import 'dotenv/config';
import { createApp } from './app';

// Last-resort safety net for anything outside an Express request (a stray
// unawaited promise, a timer callback that throws). app.ts's error
// middleware already covers the normal case — this just stops the process
// from ever going down silently for something it didn't.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

// Deliberately NOT named PORT: some dev tooling (this project's own preview
// harness included) sets a PORT env var for its own port-tracking purposes,
// and since dotenv never overrides an already-set variable, a generically
// named PORT here can silently pick up the wrong value and collide with the
// Vite dev server. API_PORT can't collide with anything.
const port = Number(process.env.API_PORT ?? 4000);

const app = createApp();

app.listen(port, () => {
  console.log(`SyntaxTree API listening on http://localhost:${port}`);
});
