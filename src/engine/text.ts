// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { FONT, LH, NODE_FS, TEXT_FS } from './constants';
import { esc, isNode } from './state-init';

export function wrap(text, maxW, fs, bold) {
  STATE.mctx.font = `${bold ? 700 : 400} ${fs}px ${FONT}`;
  const W = s => STATE.mctx.measureText(s).width, out = [];
  for (const para of String(text).split('\n')) {
    const toks = para.match(/[A-Za-z0-9_\-.,!?;:'"()@#$%&*+=\/\\<>\[\]{}~`^|]+ *| +|[\s\S]/gu) || [];
    let line = '';
    for (const t of toks) {
      if (W((line + t).trimEnd()) <= maxW) { line += t; continue; }
      if (line) { out.push(line.trimEnd()); line = ''; }
      const tt = t.replace(/^ +/, '');
      if (W(tt.trimEnd()) <= maxW) { line = tt; continue; }
      for (const ch of tt) { if (W(line + ch) > maxW && line) { out.push(line); line = ch; } else line += ch; }
    }
    out.push(line.trimEnd());
  }
  return out;
}
export function innerBox(n) {
  const { x, y, w, h } = n;
  if (n.shape === 'circle') return { x: x + w * .15, y: y + h * .15, w: w * .7, h: h * .7 };
  if (n.shape === 'diamond') return { x: x + w * .22, y: y + h * .22, w: w * .56, h: h * .56 };
  if (n.shape === 'capsule') { const p = Math.min(h * .4, w * .2); return { x: x + p, y: y + 8, w: w - 2 * p, h: h - 16 }; }
  return { x: x + 16, y: y + 12, w: w - 32, h: h - 24 };
}
export const TPX = 8, TPY = 6;
export const defFs = it => it.fs || (it.type === 'text' ? TEXT_FS : NODE_FS);
export function textH(t) { const fs = defFs(t); return Math.max(1, wrap(t.text, t.w - 2 * TPX, fs, t.bold).length) * fs * LH + 2 * TPY; }
export function fitNode(n) {
  if (!n || !n.fit || !isNode(n)) return;
  const fs = defFs(n), b = innerBox(n), need = Math.max(1, wrap(n.text || ' ', b.w, fs, n.bold).length) * fs * LH;
  const h = n.shape === 'circle' ? need / .7 + 12 : n.shape === 'diamond' ? need / .56 + 12 : n.shape === 'capsule' ? need + 28 : need + 36;
  n.h = Math.round(Math.max(44, h));
}
export function bbox(it) { return it.type === 'text' ? { x: it.x, y: it.y, w: it.w, h: textH(it) } : { x: it.x, y: it.y, w: it.w, h: it.h }; }
export function textSVG(lines, box, fs, color, bold, align, valign) {
  const lh = fs * LH, total = lines.length * lh;
  const top = valign === 'top' ? box.y : valign === 'bottom' ? box.y + box.h - total : box.y + (box.h - total) / 2;
  const x = align === 'left' ? box.x : align === 'right' ? box.x + box.w : box.x + box.w / 2;
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  return `<text font-size="${fs}" fill="${color}" font-weight="${bold ? 700 : 400}" text-anchor="${anchor}" style="pointer-events:none;white-space:pre">` +
    lines.map((l, i) => `<tspan x="${x}" y="${(top + i * lh + lh / 2 + fs * .36).toFixed(2)}">${esc(l) || ' '}</tspan>`).join('') + '</text>';
}

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initText() {
  STATE.mctx = document.createElement('canvas').getContext('2d');
}
