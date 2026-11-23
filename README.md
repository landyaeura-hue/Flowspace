# FlowSpace

Infinite-canvas whiteboard and flowchart editor: shapes, connectors, text, handwriting, auto layout,
light physics, five colour themes with a night mode. Real-time collaboration is on the roadmap.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/
```

## Project layout

```
src/
  main.tsx            React entry
  app/App.tsx         mounts the shell, then starts the canvas engine
  app/Shell.tsx       static editor chrome (toolbars, menus, panels, canvas <svg>)
  engine/engine.ts    canvas engine (rendering, interaction, routing, physics, layout, ink, export…)
  engine/themes.ts    the five colour themes, light + night palettes (typed)
  engine/constants.ts fonts, font sizes, default shape sizes
  engine/types.ts     canvas document model (nodes, text boxes, handwriting, connectors)
  styles/app.css      all editor styles
docs/MIGRATION.md     migration status and next steps
```

Canvases are saved in the browser's localStorage (`flowspace.index`, `flowspace.doc.<id>`).
Use **Share → Export canvas file** in the old preview and **Import canvas file** here to bring a canvas across.

## Deploy

Vercel: import this repository; framework preset **Vite**, build `npm run build`, output `dist`.
