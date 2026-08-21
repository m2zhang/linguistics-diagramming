# SyntaxTree — Linguistics Tree Editor & Course Platform

A modern web application for building, editing, and exporting linguistic syntax trees, featuring a complete classroom platform: instructors manage courses with lectures and assignments; students join via course code, work in the tree canvas, and submit assignments for grading.

---

## Architecture Overview

SyntaxTree uses a modern client-first architecture powered by **React + Vite** and **Supabase**:

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Zustand, and SVG rendering.
- **Backend / Database**: Supabase (PostgreSQL with Row Level Security & Supabase Auth).
- **Authentication**: Email/password authentication & Google OAuth via Supabase Auth.

---

## Features

### 🌳 Tree Editor (Standalone or Integrated)
- **Live Dual-Input Engine**: Paste bracket notation (`[S [NP [D the] [N cat]] [VP [V sat]]]`) to render trees live; canvas edits automatically update bracket notation text.
- **Interactive SVG Canvas**: Drag to pan, wheel to zoom, fit-to-view, click to select, double-click to rename inline, `Delete` to remove nodes.
- **Drag-and-Drop Node Library**: Node Down, Binary, and Ternary branch presets.
- **Symbol & Template Libraries**: NP, VP, PP, CP, and full sentence templates, plus X-bar, trace, and feature symbol sets.
- **Export Options**: PNG, Vector PDF, SVG, and copyable LaTeX (`qtree`).
- **Photo → Tree (Experimental)**: Client-side OCR pipeline (Tesseract.js) to infer tree structure from hand-drawn diagrams.
- **Role-Gated Tools**: Basic tools for students, full advanced toolsets (including LaTeX output) for instructors.

### 🎓 Classroom & Course Management
- **User Roles & Onboarding**: Students, Instructors, and TAs (Teaching Assistants get instructor-level course access).
- **Course Enrollment**: Instructors create courses and share join codes; students enroll instantly.
- **Lectures & Materials**: Shared lesson trees and downloadable file attachments (PDFs, images).
- **Assignments with Max Grades**: Blank canvas or template-based starting trees. Instructors set custom max points (e.g., out of 10 or 100).
- **Protected Student Workspace**: Student edits create isolated private drafts and submissions; instructor-shared templates and lecture trees are read-only and fully protected.
- **Dedicated Grading Panel**:
  - Hides left panels during grading for maximum canvas workspace.
  - Dedicated right panel displaying student details, score out of max points, feedback input, and one-click navigation across class submissions.

---

## Getting Started

### Prerequisites
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **Supabase Account** (or a local Supabase CLI instance)

### 1. Environment Setup
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in your Supabase project credentials in `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
   ```

### 2. Database Migration (Supabase)
Run the SQL files in `supabase/migrations/` in order against your Supabase database:
- `0001_initial_schema.sql`
- `0002_onboarding.sql`

*(You can paste these into the Supabase Dashboard SQL Editor, or use the Supabase CLI: `npx supabase db push`)*

### 3. Installation & Local Development
Install dependencies and launch the dev server:

```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Useful Commands

```bash
npm run dev        # Starts Vite dev server (:5173)
npm run build      # Typechecks (tsc -b) and builds production bundle in dist/
npm run preview    # Previews the production build locally
npm test           # Runs Vitest unit tests for parser, serializer, and layout
```

---

## Deploying to a subpath (UTSC server)

The app is a static bundle, but it uses client-side routing, so it needs two
things the domain root would give it for free: an explicit base path, and a
server rewrite.

Build with `VITE_BASE_PATH` set to the path the app is served from, including
both slashes:

```bash
VITE_BASE_PATH=/~you/syntaxtree/ npm run build
```

That single variable drives the asset base, the React Router `basename`, and the
Supabase redirect URLs together, so they cannot drift apart. Then upload the
contents of `dist/` — including the `.htaccess` it ships, which is what stops a
hard refresh on `/courses/<id>/lectures` from 404ing before React loads.

Finally, in the Supabase dashboard under **Authentication → URL Configuration**,
add the deployed URL to **Redirect URLs**:

```
https://<host>.utsc.utoronto.ca/~you/syntaxtree/*
```

Without that entry Google sign-in and password reset are rejected by Supabase
even though the app itself is configured correctly.

> Serving from the domain root instead? Omit `VITE_BASE_PATH` entirely; it
> defaults to `/` and everything above still applies except the base path.

---

## Project Structure

```
linguistics-diagramming/
├── src/
│   ├── auth/              # AuthGate, Signup, Login, Onboarding screens
│   ├── components/        # Tree canvas, toolbar, node/symbol libraries, layout primitives
│   │   ├── assignment/    # AssignmentEditor, AssignmentWorkBanner, GradingPanel
│   │   ├── course/        # Course headers, participant views, dialogs
│   │   ├── layout/        # AppHeader, AuthLayout, CourseSidebar, DashboardSidebar
│   │   └── ui/            # Reusable UI components (buttons, cards, badges, inputs)
│   ├── data/              # Typed Supabase client API wrappers (auth, courses, assignments, etc.)
│   ├── export/            # PNG / PDF / SVG export logic & ProjectState serialization
│   ├── hooks/             # Custom hooks (autosave, persistence, UI state)
│   ├── lib/               # Supabase client initialization & helper utilities
│   ├── model/             # TreeNode data structure, bracket parser, layout engine
│   ├── pages/             # Dashboard, Course pages, Profile, SubmissionReview
│   └── store/             # Zustand state management (treeStore, authStore, uiStore)
├── supabase/
│   └── migrations/        # SQL schema & RLS policy migrations
├── package.json
└── README.md
```
