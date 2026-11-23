// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { animAttr, animOf, now } from './dom';
import { find, isInk, normalize, uid } from './state-init';
import { commit } from './storage';
import { tc } from './theme';

// ---------- ink (pen strokes) ----------
export const PEN_STYLES = [['fountain', 'Fountain'], ['ballpoint', 'Ballpoint'], ['brush', 'Calligraphy']];
export function resample(P) {
  // Catmull-Rom through captured points, ~2px spacing
  if (P.length < 3) return P;
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const n = Math.max(1, Math.min(12, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2)));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const c = k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([c(0), c(1), p1[2] + ((p2[2] ?? .5) - (p1[2] ?? .5)) * t]);
    }
  }
  out.push(P[P.length - 1]); return out;
}
export function strokeEls(P, sw, style) {
  if (!P.length) return '';
  style = style || 'ballpoint';
  const f = v => v.toFixed(2), pts = resample(P), n = pts.length;
  // how fast the stroke ended (spacing of the last raw samples) → flick = sharp tapered tail, slow stop = blunt end
  const k3 = P.slice(-4); let seg = 0; for (let i = 1; i < k3.length; i++) seg += Math.hypot(k3[i][0] - k3[i - 1][0], k3[i][1] - k3[i - 1][1]);
  const fast = Math.min(1, Math.max(0, (seg / Math.max(1, k3.length - 1) / Math.max(1, sw * .5) - .8) / 2.2)), tMin = .7 - .64 * fast;
  const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[n - 1], pr = i => Math.min(1, Math.max(0, pts[i][2] == null ? .5 : pts[i][2]));
  const NIB = -0.7;
  let R = pts.map((q, i) => {
    const p = pr(i);
    if (style === 'ballpoint') return sw / 2 * (.8 + .4 * p);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const tS = Math.min(1, cum[i] / Math.max(2, sw * (style === 'brush' ? 2 : 1.2)));
    const endLen = Math.max(sw * 3, Math.min(sw * 9, total * .28)), tE = Math.min(1, (total - cum[i]) / endLen);
    const endF = tMin + (1 - tMin) * Math.pow(tE, .55);
    if (style === 'brush') return sw / 2 * (.18 + 1.5 * Math.abs(Math.sin(ang - NIB))) * (.55 + .7 * p) * (.6 + .4 * Math.sqrt(tS)) * endF;
    return sw / 2 * (.18 + 1.55 * p) * (.7 + .3 * Math.sqrt(tS)) * endF;
  });
  R = R.map((r, i) => (R[Math.max(0, i - 1)] + 2 * r + R[Math.min(n - 1, i + 1)]) / 4);
  const cap = (q, r) => r > .05 ? `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(r)}"/>` : '';
  if (n === 1 || total < .5) return cap(pts[0], Math.max(R[0], sw * .45));
  const L = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    L.push([pts[i][0] - dy * R[i], pts[i][1] + dx * R[i]]); Rt.push([pts[i][0] + dy * R[i], pts[i][1] - dx * R[i]]);
  }
  const ring = L.concat(Rt.reverse()), m2 = ring.length, mid = (a, b) => `${f((a[0] + b[0]) / 2)},${f((a[1] + b[1]) / 2)}`;
  let d = `M${mid(ring[m2 - 1], ring[0])}`;
  for (let i = 0; i < m2; i++) d += `Q${f(ring[i][0])},${f(ring[i][1])} ${mid(ring[i], ring[(i + 1) % m2])}`;
  return `<path d="${d}Z"/>` + cap(pts[0], R[0]) + cap(pts[n - 1], R[n - 1]);
}
export function inkAbs(it) {
  const sx = it.w / (it.ow || it.w || 1), sy = it.h / (it.oh || it.h || 1);
  return { s: Math.sqrt(sx * sy) || 1, strokes: it.strokes.map(st => st.map(([x, y, p]) => [it.x + x * sx, it.y + y * sy, p])) };
}
export function inkSVG(it, exp?) {
  const A = inkAbs(it), body = A.strokes.map(st => strokeEls(st, it.sw * A.s, it.pen)).join('');
  const hit = exp ? '' : `<g fill="none" stroke="transparent" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">${A.strokes.map(st => `<polyline points="${st.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}"/>`).join('')}</g>`;
  return `<g ${exp ? '' : `data-id="${it.id}"`}${exp ? '' : animAttr(animOf(it.id))}><g fill="${tc(it)}">${body}</g>${hit}</g>`;
}
export function finishInk(d) {
  const pts = d.pts; if (!pts.length) return;
  const col = STATE.penPref.color, sw = STATE.penPref.sw, pad = sw * 1.2;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const last = STATE.lastInk && find(STATE.lastInk.id), near = 90 / STATE.view.k;
  let strokes = [pts];
  if (isInk(last) && now() - STATE.lastInk.t < 1800 && last.color === col && (last.pen || 'ballpoint') === STATE.penPref.style && Math.abs(last.sw * inkAbs(last).s - sw) < .5 &&
      x0 < last.x + last.w + near && x1 > last.x - near && y0 < last.y + last.h + near && y1 > last.y - near) {
    strokes = inkAbs(last).strokes.concat(strokes);
    STATE.doc.items = STATE.doc.items.filter(i => i !== last);
  }
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
  for (const st of strokes) for (const [x, y] of st) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const w = Math.max(4, x1 - x0), h = Math.max(4, y1 - y0);
  const it = normalize({ id: isInk(last) && !STATE.doc.items.includes(last) ? last.id : uid('k'), type: 'ink', x: x0, y: y0, w, h, ow: w, oh: h, sw, color: col, pen: STATE.penPref.style,
    strokes: strokes.map(st => st.map(([x, y, p]) => [+(x - x0).toFixed(2), +(y - y0).toFixed(2), +(p ?? .5).toFixed(2)])) });
  if (isInk(last) && !STATE.doc.items.includes(last) && last.g) it.g = last.g;
  STATE.doc.items.push(it); STATE.lastInk = { id: it.id, t: now() };
  commit(d.pre);
}
