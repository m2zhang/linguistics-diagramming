# SyntaxTree — Linguistics Tree Editor & Course Platform

A web app for building, editing and exporting linguistic syntax trees, with a
full classroom layer on top: instructors run courses made of lectures and
assignments; students join by code, work in the same tree canvas, and submit
for grading.

Two pieces run together in development:

- **Frontend** — React + Vite + TypeScript single-page app (`src/`). The tree
  editor itself (canvas, bracket notation, LaTeX, exports) needs no backend
  and no login.
- **Backend** — Node/Express + PostgreSQL API (`server/`) that adds accounts,
  courses, lectures, assignments, drafts, submissions and grading on top of
  the editor.

## Features

### Tree editor (works standalone, no account needed)

- **Dual-input engine** — paste bracket notation (`[S [NP [D the] [N cat]] [VP [V sat]]]`)
  and the tree renders live; edits on the canvas write back to the text.
- **SVG canvas** — pan (drag), zoom (wheel), fit-to-view; click to select,
  double-click to rename inline, `Delete` to remove a node (children reattach).
- **Drag-and-drop node library** — Node Down / Binary / Ternary presets.
- **Templates** — NP, VP, PP, CP and a full sentence starter.
- **Export** — PNG, vector PDF, SVG, and copy-to-clipboard LaTeX.
- **Session persistence** — work survives a page refresh (`sessionStorage`).
- **Photo → Tree (experimental)** — upload a photo of a hand-drawn tree; fully
  client-side OCR (Tesseract.js) + heuristic structure inference produces a
  best-guess tree to correct on the canvas. No upload, no API.
- **Dark-mode-first** UI with light-mode toggle; Inter / Montserrat typography.
- **Student / instructor modes** — the canvas toolset is gated by role: basic
  drawing tools and phrasal/lexical symbols for students, the full advanced
  toolset (drawing tools, X-bar/traces/features symbol sets, LaTeX panel) for
  instructors.

### Course platform (requires an account + the backend running)

- **Accounts** — email/password signup as a student or instructor.
- **Courses** — instructors create courses and get a join code; students join
  with the code. Per-user course preferences (color, favorite, archive) live
  on the viewer's dashboard only, not on the course itself.
- **Lectures** — notes, one or more shared lesson trees (built in the same
  canvas), and uploaded materials (PDFs, images, etc.) students can download.
- **Assignments** — blank-canvas or template-based (instructor attaches a
  starting tree students pull into their own copy). Student work autosaves as
  a draft and is explicitly submitted when ready.
- **Grading** — instructors open a submission read-only in the canvas, leave
  a grade + feedback, and step through the class roster with Previous / Next
  / "next ungraded" without leaving the editor.
- **Context-aware navigation** — opening the canvas from a lecture,
  assignment, or grading queue always returns you to that exact page, not a
  generic dashboard.

## Tech stack

**Frontend:** React + Vite + TypeScript · React Router · Zustand (state) ·
Tailwind CSS v4 + hand-built shadcn-style UI primitives (Radix underneath) ·
SVG rendering · jsPDF + svg2pdf.js (PDF) · Tesseract.js (OCR, lazy-loaded).

**Backend:** Node + Express + TypeScript · PostgreSQL via `pg` (raw SQL, no
ORM) · `node-pg-migrate` for schema migrations · `express-session` +
`connect-pg-simple` (Postgres-backed cookie sessions) · `bcrypt` for
passwords · `multer` for file uploads (stored on local disk) · `zod` for
request validation.

## Prerequisites

- Node.js 18+
- A local PostgreSQL server (native install, e.g. via `winget install
  PostgreSQL.PostgreSQL.16` on Windows, or your OS package manager — no
  Docker required)

## One-time setup

1. **Create the database.** In `psql` or pgAdmin, as a superuser:

   ```sql
   CREATE USER syntaxtree_dev WITH PASSWORD 'devpassword';
   CREATE DATABASE syntaxtree_dev OWNER syntaxtree_dev;
   \c syntaxtree_dev
   CREATE EXTENSION citext;
   CREATE EXTENSION pgcrypto;
   ```

2. **Install dependencies** (frontend + backend):

   ```bash
   npm install
   npm run server:install
   ```

3. **Configure the backend.** Copy `server/.env.example` to `server/.env` and
   fill in real values (a working default matching step 1 is already there —
   at minimum replace `SESSION_SECRET`):

   ```bash
   cd server
   cp .env.example .env       # Windows: copy .env.example .env
   cd ..
   ```

4. **Run migrations** to create all tables:

   ```bash
   npm run server:migrate
   ```

## Develop

```bash
npm run dev        # starts Vite (:5173) + the Express API (:4000) together
```

The Vite dev server proxies `/api/*` requests to the Express server, so the
frontend always calls relative `/api/...` paths. Open
[http://localhost:5173](http://localhost:5173) — the tree editor works
immediately; sign up (as a student or instructor) to reach the course
platform.

Other useful commands:

```bash
npm run dev:web            # frontend only, no backend (editor still works)
npm run dev:api            # backend only
npm test                   # vitest — frontend unit tests (parser/serializer/layout)
npm --prefix server test   # vitest — backend route/middleware tests
npm run build               # tsc -b + vite build → static output in dist/
npm run server:migrate      # apply new backend migrations
```

## Project structure

```
linguistics-diagramming/
  src/                        # frontend SPA
    components/                # editor canvas, toolbar, symbol/node libraries,
                                # course/lecture/assignment/submission UI, ui/ primitives
    pages/                      # dashboards, course pages, profile
    auth/                       # login/signup screens, AuthGate, useUser
    data/                       # typed fetch wrappers for the REST API
    store/                      # Zustand stores (tree, auth, ui)
    model/                      # TreeNode, bracket parser, layout engine
    export/                     # PNG/PDF/SVG export, ProjectState (wire format)
    vision/                     # photo → tree OCR pipeline
  server/                      # backend API
    src/
      routes/                   # auth, courses, lectures, materials, assignments, submissions
      middleware/                # session, requireAuth, requireRole, ownership checks
      migrations/                 # node-pg-migrate files (raw SQL)
      db/pool.ts                  # pg.Pool singleton
    uploads/                    # uploaded lecture/assignment materials (gitignored)
```

## Architecture

The **tree model** (`src/model/types.ts`) is the single source of truth. Bracket
text, the SVG canvas, and LaTeX are all projections of it:

```
bracket text ──parse──► TreeNode ──layout──► positioned SVG
     ▲                      │
     └──── serialize ───────┴──── serialize ──► LaTeX (qtree)
```

Key frontend modules: `model/bracketParser.ts`, `model/layout.ts`
(tidy-tree), `store/treeStore.ts` (Zustand actions), `components/TreeCanvas.tsx`.

A tree (plus freehand annotations) serializes to a single JSON shape,
`ProjectState` (`src/export/projectState.ts`). That's the one wire format
used everywhere a tree crosses the network: lecture trees, assignment
templates, student drafts, and submissions are all just a `ProjectState`
stored in a Postgres `jsonb` column.

**Auth & authorization** is session-based (no JWTs): `express-session` with
`connect-pg-simple` stores sessions in Postgres, so logout/revocation is
trivial. Every mutating backend route re-checks ownership/enrollment in SQL
(`server/src/middleware/ownership.ts`) — there's no ORM-level or
database-level (RLS) safety net, so authorization lives entirely in the route
handlers.

**Data model** (see `server/src/migrations/`): `users` → `courses` (with a
join code) → `enrollments` → `lectures` → `lecture_trees` / `materials` →
`assignments` → `drafts` (one autosaved row per student per assignment) →
`submissions` (insert-only; resubmitting adds a new row, grading is
`grade`/`feedback`/`graded_by` columns on it).
