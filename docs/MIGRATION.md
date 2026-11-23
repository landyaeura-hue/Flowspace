# Migration status

Source: single-file preview "FlowSpace Preview" (1,961 lines, 2026-11-23).

## Stage 1a — done (2026-11-23)

- Vite 6 + React 18 + TypeScript 5 (strict) project.
- Styles moved to `src/styles/app.css` unchanged.
- Editor chrome converted to a React component (`Shell.tsx`).
- Themes, constants and the document model are typed modules.
- The engine runs unchanged inside `mountEngine()` (`engine.ts`, currently `// @ts-nocheck`).
- Parity check (Playwright, 1400×860): boot, add shape, auto layout, theme + night mode, undo,
  canvas list and shortcut sheet are pixel-identical to the preview, and the saved document matches;
  no console errors.

## Stage 1b — next

Split `engine.ts` into typed modules, one at a time, re-running the parity check after each:

1. `state` – shared editor state object (doc, view, selection, tool, history) instead of closure variables
2. `text` – text measuring and wrapping
3. `shapes`, `render` – SVG generation
4. `ink` – pen strokes (resampling, pressure, nib styles)
5. `routing` – connector routing
6. `history`, `storage` – undo/redo and localStorage canvases
7. `pointer`, `guides`, `quickExtend`, `lasso`, `longPress` – interaction
8. `physics`, `layout` – elastic mode and auto layout
9. `panel`, `keyboard`, `clipboard`, `export` – UI wiring
10. `strings.ts` – all English UI copy in one place

Then: Zustand for UI state, and the document moved to Yjs (stage 3 prerequisite).
