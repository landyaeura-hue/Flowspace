// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { isNode } from './state-init';

// ---------- coordinates & hit testing ----------
export function toWorld(e) { const r = STATE.svg.getBoundingClientRect(); return { x: (e.clientX - r.left - STATE.view.x) / STATE.view.k, y: (e.clientY - r.top - STATE.view.y) / STATE.view.k }; }
export const inside = (p, b, m = 0) => p.x >= b.x - m && p.x <= b.x + b.w + m && p.y >= b.y - m && p.y <= b.y + b.h + m;
export function nodeAt(p, m = 0, except?) { const ns = STATE.doc.items.filter(isNode); for (let i = ns.length - 1; i >= 0; i--) if (ns[i].id !== except && inside(p, ns[i], m)) return ns[i]; return null; }
