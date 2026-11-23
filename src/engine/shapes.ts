// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { animAttr, animOf } from './dom';
import { TPX, TPY, defFs, innerBox, textH, textSVG, wrap } from './text';
import { fillOf, tc } from './theme';

// ---------- shapes ----------
export function roundPoly(pts, r) {
  const n = pts.length; let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a.x - p.x, a.y - p.y), lb = Math.hypot(b.x - p.x, b.y - p.y);
    const rr = Math.min(r, la / 2, lb / 2);
    const p1 = { x: p.x + (a.x - p.x) * rr / la, y: p.y + (a.y - p.y) * rr / la }, p2 = { x: p.x + (b.x - p.x) * rr / lb, y: p.y + (b.y - p.y) * rr / lb };
    d += `${i ? 'L' : 'M'}${p1.x.toFixed(2)},${p1.y.toFixed(2)}Q${p.x},${p.y} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d + 'Z';
}
export function shapeEl(n, attrs) {
  const { x, y, w, h } = n;
  switch (n.shape) {
    case 'circle': return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${attrs}/>`;
    case 'diamond': return `<path d="${roundPoly([{ x: x + w / 2, y }, { x: x + w, y: y + h / 2 }, { x: x + w / 2, y: y + h }, { x, y: y + h / 2 }], n.radius * .55)}" ${attrs}/>`;
    case 'capsule': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" ${attrs}/>`;
    case 'rect': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(n.radius, 6, w / 2, h / 2) * (n.radius ? 1 : 0)}" ${attrs}/>`;
    default: return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(n.radius, w / 2, h / 2)}" ${attrs}/>`;
  }
}
export function nodeSVG(n, exp?) {
  const F = fillOf(n.fill);
  const an = exp ? null : animOf(n.id), lifted = an && an.name === 'lift';
  const a = `fill="${F.f}" stroke="${n.border ? F.s : 'none'}" stroke-width="1.2" ${n.shadow ? `filter="url(#${F.sh}${lifted ? 'L' : ''})"` : ''}`;
  let t = '';
  if (n.text && (exp || STATE.editing !== n.id)) { const b = innerBox(n), fs = defFs(n); t = textSVG(wrap(n.text, b.w, fs, n.bold), b, fs, tc(n), n.bold, n.align, n.valign); }
  return `<g ${exp ? '' : `data-id="${n.id}"`}${animAttr(an)}>${shapeEl(n, a)}${t}</g>`;
}
export function textItemSVG(t, exp?) {
  const h = textH(t);
  const hit = exp ? '' : `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${h}" fill="transparent"/>`;
  const fs = defFs(t), txt = (exp || STATE.editing !== t.id) && t.text ? textSVG(wrap(t.text, t.w - 2 * TPX, fs, t.bold), { x: t.x + TPX, y: t.y + TPY, w: t.w - 2 * TPX, h: h - 2 * TPY }, fs, tc(t), t.bold, t.align, 'top') : '';
  return `<g ${exp ? '' : `data-id="${t.id}"`}${exp ? '' : animAttr(animOf(t.id))}>${hit}${txt}</g>`;
}
