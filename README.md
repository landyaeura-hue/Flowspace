# FlowSpace

Infinite-canvas whiteboard and flowchart editor: shapes, connectors, text, handwriting, auto layout,
light physics, five colour themes with a night mode. Accounts and cloud saving (Supabase);
real-time collaboration is next.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/
npm run parity     # local-only build vs the original preview, 16 steps
npm run qa:cloud   # accounts + cloud saving against an in-browser mock backend
```

Cloud saving is on when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set
(copy `.env.example` to `.env.local` for `npm run dev`). Without them the app is local-only.

## Supabase setup (once)

1. SQL Editor → run `supabase/migrations/0001_canvases.sql` (safe to run again).
2. Authentication → Sign In / Providers → Email: on.
3. Authentication → URL Configuration: Site URL = your deployed address; Redirect URLs: add
   `https://<your-site>/**` and `http://localhost:5173/**` (email confirmation, sign-in link and
   password-reset links come back to these).

## Project layout

```
src/
  main.tsx              React entry
  app/App.tsx           mounts the shell, then starts the canvas engine
  app/Shell.tsx         static editor chrome (toolbars, menus, panels, canvas <svg>)
  engine/index.ts       mountEngine(): runs every module's init in the original order
  engine/state.ts       shared editor state (document, view, selection, tool, history…)
  engine/types.ts       canvas document model (nodes, text boxes, handwriting, connectors)
  engine/themes.ts      five colour themes, light + night palettes
  engine/constants.ts   fonts, font sizes, default shape sizes
  engine/strings.ts     English UI copy (toasts, shortcut sheet)
  engine/dom.ts         shell lookups, animation helpers
  engine/theme.ts       palettes → SVG defs, CSS variables, theme picker
  engine/state-init.ts  sample canvas, object helpers
  engine/text.ts        text measuring and wrapping
  engine/shapes.ts      node shapes
  engine/ink.ts         pen strokes (smoothing, pressure, nibs)
  engine/routing.ts     connector routing
  engine/render.ts      SVG rendering
  engine/storage.ts     undo/redo, canvas list, saving into the active space
  engine/space.ts       which localStorage space is active (this browser, or an account's cache)
cloud/
  backend.ts            what the sync needs from a backend
  supabase-backend.ts   Supabase Auth + Postgres + Storage
  mock-backend.ts       in-browser stand-in used by qa/cloud.cjs
  sync.ts               autosave, offline retry, version conflicts, thumbnails, uploading local canvases
  store.ts              account / sync UI state (Zustand)
app/Account.tsx         account button, sign-in dialogs, upload offer, conflict prompt
  engine/coords.ts      coordinates and hit testing
  engine/editing.ts     in-place text editing
  engine/pointer.ts     pointer, touch, pen, wheel, long-press, lasso
  engine/guides.ts      alignment guides and snapping
  engine/quick-extend.ts  "+" handles, Tab to extend
  engine/physics.ts     elastic mode
  engine/layout.ts      auto layout
  engine/selection.ts   delete, copy/paste, group, arrange, styles, layers
  engine/panel.ts       property panel
  engine/keyboard.ts    shortcuts
  engine/chrome.ts      toolbar, menus, background switch
  engine/clipboard.ts   system clipboard
  engine/help.ts        shortcut sheet, toasts
  engine/export.ts      PNG / SVG / JSON export and import
styles/app.css          all editor styles
qa/parity.cjs           compares this app with the original preview, step by step
tools/                  one-off scripts used for the migration
docs/MIGRATION.md       migration status and next steps
```

Signed out, canvases are saved in the browser's localStorage (`flowspace.index`, `flowspace.doc.<id>`).
Signed in, the editor works on a per-account cache (`flowspace.u.<user id>.*`) that `cloud/sync.ts`
mirrors to the `canvases` table; every write is checked against the row's `version`, so an edit made
on another device is never silently overwritten (the user picks: use latest / keep mine / keep both).
Use **Share → Export canvas file** in the old preview and **Import canvas file** here to bring a canvas across.

## Deploy

Vercel: import this repository; framework preset **Vite**, build `npm run build`, output `dist`;
add the two `VITE_SUPABASE_…` environment variables.
