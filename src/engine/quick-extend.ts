// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { FS_STEPS } from './constants';
import { anim } from './dom';
import { openEditor } from './editing';
import { tweenView } from './pointer';
import { render } from './render';
import { SIDES, newEdge } from './routing';
import { mutate, selObjs } from './selection';
import { find, isEdge, isNode, normalize, snap, uid } from './state-init';
import { defFs, fitNode } from './text';

// ---------- quick extend ----------
export function flowSide(a) {
  const pe = STATE.doc.edges.find(e => e.to === a.id), p = pe && find(pe.from); if (!p) return 'r';
  const dx = (a.x + a.w / 2) - (p.x + p.w / 2), dy = (a.y + a.h / 2) - (p.y + p.h / 2);
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'r' : 'l') : (dy >= 0 ? 'b' : 't');
}
export function quickAdd(base, side, parent, gap = 80) {
  if (!base) return;
  const pre = snap(), [sx, sy] = SIDES[side], w = base.w, h = base.h;
  const free = (x, y) => !STATE.doc.items.some(o => isNode(o) && x < o.x + o.w + 16 && x + w + 16 > o.x && y < o.y + o.h + 16 && y + h + 16 > o.y);
  const bx = base.x + sx * (w + gap), by = base.y + sy * (h + gap); let x = bx, y = by;
  for (let i = 1; i < 16 && !free(x, y); i++) { const o = (i % 2 ? 1 : -1) * Math.ceil(i / 2); if (sx) y = by + o * (h + 36); else x = bx + o * (w + 36); }
  const n = normalize({ id: uid('n'), type: 'node', shape: base.shape, fill: base.fill, radius: base.radius, border: base.border, shadow: base.shadow, fs: base.fs, fit: base.fit, color: base.color, w, h, x: Math.round(x), y: Math.round(y) });
  STATE.doc.items.push(n); anim(n.id, 'pop', 300);
  if (parent) { const ne = newEdge(parent.id, n.id); STATE.doc.edges.push(ne); anim(ne.id, 'draw', 360); setTimeout(render, 380); }
  openEditor(n.id, pre); ensureVisible(n);
}
export function addSibling(a) {
  const pe = STATE.doc.edges.find(e => e.to === a.id), p = pe && find(pe.from), f = flowSide(a);
  quickAdd(a, f === 'r' || f === 'l' ? 'b' : 'r', p || null, 40);
}
export function ensureVisible(b) {
  const r = STATE.svg.getBoundingClientRect(), k = STATE.view.k, m = 80, pr = STATE.panel.classList.contains('show') ? 290 : m;
  const sx0 = STATE.view.x + b.x * k, sy0 = STATE.view.y + b.y * k, sx1 = sx0 + b.w * k, sy1 = sy0 + b.h * k;
  let dx = 0, dy = 0;
  if (sx1 > r.width - pr) dx = r.width - pr - sx1; if (sx0 + dx < m) dx = m - sx0;
  if (sy1 > r.height - m) dy = r.height - m - sy1; if (sy0 + dy < m) dy = m - sy0;
  if (dx || dy) { const v0 = { ...STATE.view }; tweenView(e => { STATE.view = { k: v0.k, x: v0.x + dx * e, y: v0.y + dy * e }; }, 300); }
}
export function stepFs(dir) {
  const objs = selObjs().filter(o => !isEdge(o)); if (!objs.length) return;
  mutate(() => objs.forEach(o => { const c = defFs(o); o.fs = dir > 0 ? (FS_STEPS.find(v => v > c) || c) : ([...FS_STEPS].reverse().find(v => v < c) || c); fitNode(o); }));
}
