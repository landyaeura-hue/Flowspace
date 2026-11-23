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

## Stage 1b — done (2026-11-23)

- `engine.ts` split into 24 modules, one per section of the preview, by `tools/split-engine.cjs`
  (TypeScript compiler API, so every reference was rewritten by symbol, not by text search).
- Former closure variables now live in one typed `STATE` object (`state.ts`); each module has an
  `init…()` and `mountEngine()` runs them in the preview's original top-to-bottom order.
- `// @ts-nocheck` removed: the whole engine type-checks. Document, view, selection, history,
  canvas index and the DOM refs are typed; type guards `isNode / isText / isEdge / isInk` narrow items.
  For now `noImplicitAny` and `strictNullChecks` are off (see below).
- Toast messages and the shortcut sheet moved to `strings.ts`.
- Parity (`npm run parity`, 16 steps: edit text incl. Chinese, add shapes, connect, Tab extend, pen,
  lasso + group, duplicate, elastic drag, align, context menu, fit, undo, new canvas, switch canvas,
  property panel): saved data identical to the preview at every step, no console errors. The only
  pixel differences are inside the mouse-drawn pen stroke, whose simulated pressure is time-based
  and differs between two runs of the preview itself as well.

## Next

1. Turn `noImplicitAny` and `strictNullChecks` back on module by module (start with routing, layout,
   text, ink — pure logic), annotating parameters.
2. Remaining copy (panel labels, menus, Shell) into `strings.ts`.
3. Zustand for UI state; move the document to Yjs (prerequisite for collaboration).
