// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { find } from './state-init';
import { bbox } from './text';

// ---------- alignment guides & snapping ----------
export function axisSnap(G, boxes, ax, T) {
  const P = b => ax ? b.y : b.x, S = b => ax ? b.h : b.w, C0 = b => ax ? b.x : b.y, C1 = b => ax ? b.x + b.w : b.y + b.h;
  const ov = (a, b) => C0(a) < C1(b) && C1(a) > C0(b), mc = (a, b) => (Math.max(C0(a), C0(b)) + Math.min(C1(a), C1(b))) / 2;
  let best = null;
  const g = [P(G), P(G) + S(G) / 2, P(G) + S(G)];
  for (const b of boxes) for (const ci of [P(b), P(b) + S(b) / 2, P(b) + S(b)]) for (const gi of g) { const d = ci - gi; if (Math.abs(d) < T && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, kind: 'align' }; }
  const tryC = (d, segs) => { if (Math.abs(d) < T && (!best || Math.abs(d) < Math.abs(best.d) - .01)) best = { d, kind: 'space', segs }; };
  const row = boxes.filter(b => ov(b, G));
  const A = row.filter(b => P(b) + S(b) <= P(G) + T).sort((a, b) => (P(b) + S(b)) - (P(a) + S(a)))[0];
  const B = row.filter(b => P(b) >= P(G) + S(G) - T).sort((a, b) => P(a) - P(b))[0];
  if (A) { const A2 = boxes.filter(b => b !== A && ov(b, A) && P(b) + S(b) <= P(A)).sort((a, b) => (P(b) + S(b)) - (P(a) + S(a)))[0];
    if (A2) { const gap = P(A) - P(A2) - S(A2); tryC(P(A) + S(A) + gap - P(G), [[P(A2) + S(A2), P(A), mc(A2, A)], [P(A) + S(A), P(A) + S(A) + gap, mc(A, G)]]); } }
  if (B) { const B2 = boxes.filter(b => b !== B && ov(b, B) && P(b) >= P(B) + S(B)).sort((a, b) => P(a) - P(b))[0];
    if (B2) { const gap = P(B2) - P(B) - S(B); tryC(P(B) - gap - S(G) - P(G), [[P(B) + S(B), P(B2), mc(B, B2)], [P(B) - gap, P(B), mc(B, G)]]); } }
  if (A && B) { const free = P(B) - P(A) - S(A) - S(G); if (free > 0) { const gap = free / 2; tryC(P(A) + S(A) + gap - P(G), [[P(A) + S(A), P(A) + S(A) + gap, mc(A, G)], [P(B) - gap, P(B), mc(B, G)]]); } }
  return best;
}
export function snapMove(dx, dy, off) {
  if (off) return { dx, dy, guides: null };
  const T = 7 / STATE.view.k, mv = STATE.drag.orig, boxes = STATE.doc.items.filter(o => !(o.id in mv)).map(bbox);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id in mv) { const b = bbox(find(id)), x = mv[id].x + dx, y = mv[id].y + dy; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + b.w); y1 = Math.max(y1, y + b.h); }
  if (x0 === Infinity) return { dx, dy, guides: null };
  const G = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  const sx = axisSnap(G, boxes, 0, T), sy = axisSnap(G, boxes, 1, T);
  if (sx) { dx += sx.d; G.x += sx.d; } if (sy) { dy += sy.d; G.y += sy.d; }
  const lines = [], spaces = [], near = (a, b) => Math.abs(a - b) < 1;
  if (sx && sx.kind === 'align') for (const v of [G.x, G.x + G.w / 2, G.x + G.w]) for (const b of boxes) if ([b.x, b.x + b.w / 2, b.x + b.w].some(c => near(c, v))) lines.push({ x1: v, y1: Math.min(G.y, b.y) - 8, x2: v, y2: Math.max(G.y + G.h, b.y + b.h) + 8 });
  if (sy && sy.kind === 'align') for (const v of [G.y, G.y + G.h / 2, G.y + G.h]) for (const b of boxes) if ([b.y, b.y + b.h / 2, b.y + b.h].some(c => near(c, v))) lines.push({ x1: Math.min(G.x, b.x) - 8, y1: v, x2: Math.max(G.x + G.w, b.x + b.w) + 8, y2: v });
  if (sx && sx.kind === 'space') sx.segs.forEach(([a, b, c]) => spaces.push({ x1: a, y1: c, x2: b, y2: c }));
  if (sy && sy.kind === 'space') sy.segs.forEach(([a, b, c]) => spaces.push({ x1: c, y1: a, x2: c, y2: b }));
  return { dx, dy, guides: { lines, spaces } };
}
