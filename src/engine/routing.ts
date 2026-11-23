// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { FONT, LBL_FS, LH } from './constants';
import { animOf, now } from './dom';
import { find, isNode, uid } from './state-init';
import { textSVG, wrap } from './text';
import { canvasBg } from './theme';

// ---------- connector routing ----------
export const SIDES = { t: [0, -1], r: [1, 0], b: [0, 1], l: [-1, 0] };
export function anchor(n, s) {
  const { x, y, w, h } = n;
  return s === 't' ? { x: x + w / 2, y } : s === 'r' ? { x: x + w, y: y + h / 2 } : s === 'b' ? { x: x + w / 2, y: y + h } : { x, y: y + h / 2 };
}
export function segHits(p, q, r) {
  const x0 = r.x + 2, x1 = r.x + r.w - 2, y0 = r.y + 2, y1 = r.y + r.h - 2;
  if (p.y === q.y) { const a = Math.min(p.x, q.x), b = Math.max(p.x, q.x); return p.y > y0 && p.y < y1 && b > x0 && a < x1; }
  const a = Math.min(p.y, q.y), b = Math.max(p.y, q.y); return p.x > x0 && p.x < x1 && b > y0 && a < y1;
}
export function route(A, B) {
  let best = null; const others = STATE.doc.items.filter(o => isNode(o) && o !== A && o !== B);
  for (const S in SIDES) for (const T in SIDES) {
    const s = anchor(A, S), t = anchor(B, T), [sx, sy] = SIDES[S], [tx, ty] = SIDES[T];
    let pts = null;
    if (sx && tx) { if (sx === -tx && (t.x - s.x) * sx > 24) { const m = (s.x + t.x) / 2; pts = [s, { x: m, y: s.y }, { x: m, y: t.y }, t]; } }
    else if (sy && ty) { if (sy === -ty && (t.y - s.y) * sy > 24) { const m = (s.y + t.y) / 2; pts = [s, { x: s.x, y: m }, { x: t.x, y: m }, t]; } }
    else if (sx) { const c = { x: t.x, y: s.y }; if ((c.x - s.x) * sx > 14 && (t.y - c.y) * -ty > 14) pts = [s, c, t]; }
    else { const c = { x: s.x, y: t.y }; if ((c.y - s.y) * sy > 14 && (t.x - c.x) * -tx > 14) pts = [s, c, t]; }
    if (!pts) continue;
    let cost = 0, bends = 0;
    for (let i = 1; i < pts.length; i++) {
      cost += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
      if (segHits(pts[i - 1], pts[i], A) || segHits(pts[i - 1], pts[i], B)) cost += 2000;
      for (const o of others) if (segHits(pts[i - 1], pts[i], o)) cost += 400;
    }
    for (let i = 1; i < pts.length - 1; i++) if (Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y) > .5) bends++;
    cost += bends * 30;
    if (!best || cost < best.cost) best = { cost, pts, S, T };
  }
  if (best) { const r: any = best.pts; r.sS = best.S; r.tS = best.T; return r; }
  const ac = { x: A.x + A.w / 2, y: A.y + A.h / 2 }, bc = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
  const S = Math.abs(bc.x - ac.x) > Math.abs(bc.y - ac.y) ? (bc.x > ac.x ? 'r' : 'l') : (bc.y > ac.y ? 'b' : 't'), T = { r: 'l', l: 'r', b: 't', t: 'b' }[S];
  const r: any = [anchor(A, S), anchor(B, T)]; r.sS = S; r.tS = T; return r;
}
export function pathD(raw, r, cutE = true, cutS = false) {
  const pts = [];
  for (const p of raw) { const q = pts[pts.length - 1]; if (!q || Math.abs(q.x - p.x) + Math.abs(q.y - p.y) > .5) pts.push({ ...p }); }
  for (let i = pts.length - 2; i > 0; i--) { const a = pts[i - 1], b = pts[i], c = pts[i + 1]; if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) pts.splice(i, 1); }
  const L = pts.length; if (L < 2) return '';
  const trimEnd = (i, j) => { const e = pts[i], f = pts[j], len = Math.hypot(e.x - f.x, e.y - f.y) || 1, cut = Math.min(2, len / 2); pts[i] = { x: e.x - (e.x - f.x) / len * cut, y: e.y - (e.y - f.y) / len * cut }; };
  if (cutE) trimEnd(L - 1, L - 2); if (cutS) trimEnd(0, 1);
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < L - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const rr = Math.min(r, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
    const la = Math.hypot(a.x - b.x, a.y - b.y), lc = Math.hypot(c.x - b.x, c.y - b.y);
    d += `L${b.x + (a.x - b.x) / la * rr},${b.y + (a.y - b.y) / la * rr}Q${b.x},${b.y} ${b.x + (c.x - b.x) / lc * rr},${b.y + (c.y - b.y) / lc * rr}`;
  }
  return d + `L${pts[L - 1].x},${pts[L - 1].y}`;
}
export function polyMid(pts) {
  let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let h = L / 2;
  for (let i = 1; i < pts.length; i++) { const sl = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (h <= sl) { const t = sl ? h / sl : 0; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; } h -= sl; }
  return pts[0];
}
export function edgeGeom(a, b, e) {
  const pts = route(a, b), st = e.style || 'orth', ar = e.arrow || 'end', p0 = pts[0], p1 = pts[pts.length - 1];
  if (st === 'straight') {
    const cut = (p, q) => { const l = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: p.x + (q.x - p.x) / l * 2, y: p.y + (q.y - p.y) / l * 2 }; };
    const s0 = ar === 'both' ? cut(p0, p1) : p0, s1 = ar === 'none' ? p1 : cut(p1, p0);
    return { d: `M${s0.x},${s0.y}L${s1.x},${s1.y}`, mid: { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }, p0, p1 };
  }
  if (st === 'curve') {
    const L = Math.max(36, Math.hypot(p1.x - p0.x, p1.y - p0.y) * .42), [ax, ay] = SIDES[pts.sS], [bx, by] = SIDES[pts.tS];
    const c1 = { x: p0.x + ax * L, y: p0.y + ay * L }, c2 = { x: p1.x + bx * L, y: p1.y + by * L };
    return { d: `M${p0.x},${p0.y}C${c1.x},${c1.y} ${c2.x},${c2.y} ${p1.x},${p1.y}`, mid: { x: (p0.x + 3 * c1.x + 3 * c2.x + p1.x) / 8, y: (p0.y + 3 * c1.y + 3 * c2.y + p1.y) / 8 }, p0, p1 };
  }
  return { d: pathD(pts, 14, ar !== 'none', ar === 'both'), mid: polyMid(pts), p0, p1 };
}
export const edgeGeomOf = e => { const a = find(e.from), b = find(e.to); return a && b ? edgeGeom(a, b, e) : null; };
export const newEdge = (from, to) => ({ id: uid('e'), from, to, style: (STATE.doc.edgeDef || {}).style || 'orth', arrow: (STATE.doc.edgeDef || {}).arrow || 'end' });
export function edgeSVG(e, exp?) {
  const a = find(e.from), b = find(e.to); if (!a || !b) return '';
  const g = edgeGeom(a, b, e), d = g.d, s = !exp && STATE.sel.has(e.id);
  const an = exp ? null : animOf(e.id), drawing = an && an.name === 'draw';
  const mk = s ? 'arS' : 'ar', arw = e.arrow || 'end', marks = arw === 'none' ? '' : `marker-end="url(#${mk})"` + (arw === 'both' ? ` marker-start="url(#${mk})"` : '');
  let lbl = '';
  if (e.label && (exp || STATE.editing !== e.id)) {
    const lines = wrap(e.label, 160, LBL_FS, false); STATE.mctx.font = `400 ${LBL_FS}px ${FONT}`;
    const w = Math.max(...lines.map(l => STATE.mctx.measureText(l).width)) + 18, h = lines.length * LBL_FS * LH + 8, bx = g.mid.x - w / 2, by = g.mid.y - h / 2;
    lbl = `<rect x="${bx}" y="${by}" width="${w}" height="${h}" rx="${Math.min(10, h / 2)}" fill="${canvasBg(STATE.doc)}" ${s ? `stroke="${STATE.C.selSoft}" stroke-width="1"` : ''}/>` + textSVG(lines, { x: bx, y: by + 4, w, h: h - 8 }, LBL_FS, s ? STATE.C.selStrong : STATE.C.ink, false, 'center', 'middle');
  }
  const halo = s && !drawing ? `<path d="${d}" fill="none" stroke="${STATE.C.selStrong}" stroke-opacity=".18" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>` : '';
  const vis = `<path d="${d}" ${drawing ? `pathLength="1" class="vis an an-draw" style="animation-delay:-${Math.round(now() - an.t0)}ms"` : `class="vis" ${marks}`} fill="none" stroke="${s ? STATE.C.selStrong : STATE.C.line}" stroke-width="${s ? 2.8 : 2}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const fade = !exp && STATE.drag && STATE.drag.type === 'reconnect' && STATE.drag.eid === e.id ? ' style="opacity:.25"' : '';
  return `<g ${exp ? '' : `data-id="${e.id}" class="edge${s ? ' on' : ''}"`}${fade}>${halo}${exp ? '' : `<path d="${d}" class="hit"/>`}${vis}${lbl}</g>`;
}
