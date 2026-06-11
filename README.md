# SyntaxTree — Modern Linguistics Tree Editor

A frontend-only web app for building, editing and exporting linguistic syntax
trees. Build trees with **bracket notation** or **drag-and-drop**, then export to
**PNG / PDF / SVG** or copy **LaTeX (qtree)** for Overleaf. No backend, no login,
no database — everything runs in the browser.

## Features

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

## Tech stack

React + Vite + TypeScript · Zustand (state) · SVG rendering · jsPDF + svg2pdf.js
(PDF) · Tesseract.js (OCR). Heavy deps (PDF, OCR) are lazy-loaded.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest (parser / serializer / layout)
npm run build    # static output in dist/ — deploy anywhere
```

## Architecture

The **tree model** (`src/model/types.ts`) is the single source of truth. Bracket
text, the SVG canvas, and LaTeX are all projections of it:

```
bracket text ──parse──► TreeNode ──layout──► positioned SVG
     ▲                      │
     └──── serialize ───────┴──── serialize ──► LaTeX (qtree)
```

Key modules: `model/bracketParser.ts`, `model/layout.ts` (tidy-tree),
`store/treeStore.ts` (Zustand actions), `components/TreeCanvas.tsx`,
`vision/` (the photo→tree pipeline).
