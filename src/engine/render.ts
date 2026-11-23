// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { $, anim, animAttr, animOf, anims, now } from './dom';
import { placeEditor } from './editing';
import { inkSVG, strokeEls } from './ink';
import { SIDES, anchor, edgeGeom, edgeSVG, pathD, route } from './routing';
import { nodeSVG, shapeEl, textItemSVG } from './shapes';
import { find, isEdge, isInk, isNode, isText } from './state-init';
import { scheduleSave } from './storage';
import { bbox } from './text';

export function render() { if (!STATE.rafS) STATE.rafS = requestAnimationFrame(() => { STATE.rafS = 0; draw(); }); }
export function draw() {
  const nodes = STATE.doc.items.filter(isNode), texts = STATE.doc.items.filter(isText);
  texts.sort((a, b) => (STATE.sel.has(a.id) || STATE.editing === a.id ? 1 : 0) - (STATE.sel.has(b.id) || STATE.editing === b.id ? 1 : 0));
  for (const id of STATE.sel) if (!STATE.prevSel.has(id) && !anims.has(id)) { const o = find(id); if (o && !isEdge(o)) anim(id, 'sel', 340); }
  STATE.prevSel = new Set(STATE.sel);
  const edges = [...STATE.doc.edges].sort((a, b) => (STATE.sel.has(a.id) ? 1 : 0) - (STATE.sel.has(b.id) ? 1 : 0));
  STATE.gE.innerHTML = edges.map(e => edgeSVG(e)).join('');
  STATE.ghosts = STATE.ghosts.filter(g => now() - g.t0 < 230);
  STATE.gG.innerHTML = STATE.ghosts.map(g => `<g class="an an-out" style="animation-delay:-${Math.round(now() - g.t0)}ms">${g.html}</g>`).join('');
  STATE.gN.innerHTML = nodes.map(n => nodeSVG(n)).join('');
  STATE.gT.innerHTML = texts.map(t => textItemSVG(t)).join('');
  STATE.gK.innerHTML = STATE.doc.items.filter(isInk).map(k => inkSVG(k)).join('');
  drawUI();
  $('#hint').style.display = STATE.doc.items.length ? 'none' : 'block';
  if (STATE.editing) placeEditor();
}
export function drawUI() {
  const k = STATE.view.k, sw = 1.2 / k, r = 5 / k; let h = '';
  const handles = (b, isTxt) => {
    const pts = { nw: [0, 0], n: [.5, 0], ne: [1, 0], e: [1, .5], se: [1, 1], s: [.5, 1], sw: [0, 1], w: [0, .5] };
    return `<g class="${isTxt ? 'tbx' : ''}">` + Object.entries(pts).map(([k2, [u, v]]) => `<circle data-handle="${k2}" cx="${b.x + b.w * u}" cy="${b.y + b.h * v}" r="${r}" fill="${STATE.C.dark ? STATE.C.raised : '#fff'}" stroke="${STATE.C.sel}" stroke-width="${sw * 1.2}"/>`).join('') + '</g>';
  };
  const selItems = [...STATE.sel].map(find).filter(o => o && !isEdge(o));
  const single = selItems.length === 1 && !(STATE.drag && STATE.drag.type === 'move' && STATE.drag.moved) && !selItems[0].locked;
  for (const it of selItems) {
    const b = bbox(it), ua = animOf(it.id), uaa = ua && ua.name !== 'lift' && ua.name !== 'magnet' && ua.name !== 'nope' ? ua : null;
    h += `<g${animAttr(uaa)}>`;
    if (isText(it) || isInk(it)) h += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${STATE.C.sel}" stroke-width="${sw}" stroke-dasharray="${5 / k} ${4 / k}" pointer-events="none"/>`;
    else { const o = 5 / k; h += `<rect x="${b.x - o}" y="${b.y - o}" width="${b.w + 2 * o}" height="${b.h + 2 * o}" rx="${it.shape === 'circle' || it.shape === 'capsule' ? Math.min(b.w, b.h) / 2 + o : Math.min(it.radius + o, 30)}" fill="none" stroke="${STATE.C.selSoft}" stroke-width="${sw}" pointer-events="none"/>`; }
    if (single) h += handles(b, isText(it));
    h += '</g>';
    if (it.locked) h += `<g transform="translate(${b.x + b.w - 8 / k} ${b.y - 18 / k}) scale(${1 / k})" pointer-events="none"><rect x="-8" y="-1" width="16" height="12" rx="3" fill="${STATE.C.selSoft}"/><path d="M-4 -1v-3a4 4 0 018 0v3" fill="none" stroke="${STATE.C.selSoft}" stroke-width="1.6"/></g>`;
  }
  // group outlines
  const gb = new Map();
  for (const it of selItems) if (it.g) { const b = bbox(it), u = gb.get(it.g); gb.set(it.g, u ? unionBox([u, b]) : b); }
  for (const [, b] of gb) { const o = 12 / k; h += `<rect x="${b.x - o}" y="${b.y - o}" width="${b.w + 2 * o}" height="${b.h + 2 * o}" rx="${14 / k}" fill="none" stroke="${STATE.C.selSoft}" stroke-width="${sw}" stroke-dasharray="${3 / k} ${3 / k}" pointer-events="none"/><text x="${b.x - o}" y="${b.y - o - 5 / k}" font-size="${11 / k}" fill="${STATE.C.selStrong}" pointer-events="none">Group</text>`; }
  for (const o of [...STATE.sel].map(find)) if (isEdge(o)) {
    if (STATE.drag && STATE.drag.type === 'reconnect' && STATE.drag.eid === o.id) continue;
    const a = find(o.from), b = find(o.to); if (!a || !b) continue;
    const g = edgeGeom(a, b, o);
    [['from', g.p0], ['to', g.p1]].forEach(([end, p]) => { h += `<circle data-eend="${end}" data-edge="${o.id}" cx="${p.x}" cy="${p.y}" r="${5.5 / k}" fill="${STATE.C.dark ? STATE.C.raised : '#fff'}" stroke="${STATE.C.selStrong}" stroke-width="${1.8 / k}"><title>Drag onto another node to reconnect</title></circle>`; });
  }
  // connection handles
  const cid = STATE.drag && STATE.drag.type === 'connect' ? null : (STATE.hoverId || (selItems.length === 1 && isNode(selItems[0]) ? selItems[0].id : null));
  const cn = cid && find(cid);
  if (isNode(cn) && (STATE.tool === 'select' || STATE.tool === 'conn') && !STATE.editing && !(STATE.drag && STATE.drag.type !== 'connect' && STATE.drag.type !== 'none')) {
    const off = 28 / k;
    for (const s in SIDES) {
      const p = anchor(cn, s), cx = p.x + SIDES[s][0] * off, cy = p.y + SIDES[s][1] * off, q = 3.5 / k;
      h += `<g data-conn="${s}" data-node="${cn.id}" class="qa"><title>Click: add a connected node · Drag: draw a connector</title><circle cx="${cx}" cy="${cy}" r="${8 / k}" fill="${STATE.C.dark ? STATE.C.raised : '#fff'}" stroke="${STATE.C.selSoft}" stroke-width="${sw * 1.2}"/><path d="M${cx - q},${cy}h${2 * q}M${cx},${cy - q}v${2 * q}" stroke="${STATE.C.sel}" stroke-width="${1.6 / k}" stroke-linecap="round" pointer-events="none"/></g>`;
    }
  }
  if (STATE.drag && STATE.drag.type === 'move' && STATE.drag.guides) {
    for (const l of STATE.drag.guides.lines) h += `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${STATE.C.selSoft}" stroke-width="${1 / k}" pointer-events="none"/>`;
    for (const l of STATE.drag.guides.spaces) {
      const hz = Math.abs(l.y1 - l.y2) < .01, t = 4 / k, len = Math.round(hz ? Math.abs(l.x2 - l.x1) : Math.abs(l.y2 - l.y1));
      h += `<g stroke="${STATE.C.selStrong}" stroke-width="${1.2 / k}" pointer-events="none"><line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"/>` +
        (hz ? `<line x1="${l.x1}" y1="${l.y1 - t}" x2="${l.x1}" y2="${l.y1 + t}"/><line x1="${l.x2}" y1="${l.y2 - t}" x2="${l.x2}" y2="${l.y2 + t}"/>` : `<line x1="${l.x1 - t}" y1="${l.y1}" x2="${l.x1 + t}" y2="${l.y1}"/><line x1="${l.x2 - t}" y1="${l.y2}" x2="${l.x2 + t}" y2="${l.y2}"/>`) +
        `</g><text x="${hz ? (l.x1 + l.x2) / 2 : l.x1 + 7 / k}" y="${hz ? l.y1 - 7 / k : (l.y1 + l.y2) / 2 + 4 / k}" font-size="${10 / k}" fill="${STATE.C.selStrong}" text-anchor="${hz ? 'middle' : 'start'}" pointer-events="none">${len}</text>`;
    }
  }
  if (STATE.drag && STATE.drag.type === 'ink' && STATE.drag.pts.length) h += `<g fill="${STATE.penPref.color === 'auto' ? STATE.C.ink : STATE.penPref.color}" pointer-events="none">${strokeEls(STATE.drag.pts, STATE.penPref.sw, STATE.penPref.style)}</g>`;
  if (STATE.drag && STATE.drag.type === 'lasso' && STATE.drag.pts.length > 1) h += `<path d="M${STATE.drag.pts.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('L')}Z" fill="${STATE.C.sel}" fill-opacity=".07" stroke="${STATE.C.sel}" stroke-width="${1.4 / k}" stroke-dasharray="${5 / k} ${4 / k}" stroke-linejoin="round" pointer-events="none"/>`;
  if (STATE.lp && STATE.lp.ring) h += `<circle cx="${STATE.lp.p.x}" cy="${STATE.lp.p.y}" r="4" fill="none" stroke="${STATE.C.sel}" stroke-width="${2 / k}" style="animation:k-ring .5s ease-out forwards" pointer-events="none"/>`;
  if (STATE.drag && STATE.drag.type === 'reconnect' && STATE.drag.cur) {
    const e2 = find(STATE.drag.eid), fx = e2 && find(STATE.drag.end === 'from' ? e2.to : e2.from), tg = STATE.drag.target && find(STATE.drag.target);
    if (fx) {
      if (tg) h += glowFor(tg);
      let pts;
      if (tg) pts = STATE.drag.end === 'from' ? route(tg, fx) : route(fx, tg);
      else { const c = STATE.drag.cur, cx = fx.x + fx.w / 2, cy = fx.y + fx.h / 2, sd = Math.abs(c.x - cx) / fx.w > Math.abs(c.y - cy) / fx.h ? (c.x > cx ? 'r' : 'l') : (c.y > cy ? 'b' : 't'), a = anchor(fx, sd); pts = STATE.drag.end === 'from' ? [c, a] : [a, c]; }
      const ar = e2.arrow || 'end';
      h += `<path d="${pathD(pts, 14, ar !== 'none', ar === 'both')}" fill="none" stroke="${STATE.C.sel}" stroke-width="2" stroke-dasharray="${6 / k} ${4 / k}" ${ar === 'none' ? '' : 'marker-end="url(#arS)"'} ${ar === 'both' ? 'marker-start="url(#arS)"' : ''} pointer-events="none"/>`;
      if (!tg) h += `<circle cx="${STATE.drag.cur.x}" cy="${STATE.drag.cur.y}" r="${5.5 / k}" fill="${STATE.C.sel}" pointer-events="none"/>`;
    }
  }
  if (STATE.drag && STATE.drag.type === 'marquee' && STATE.drag.cur) { const m = rectOf(STATE.drag.start, STATE.drag.cur); h += `<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="${STATE.C.sel}" fill-opacity=".08" stroke="${STATE.C.selSoft}" stroke-width="${sw}" rx="${3 / k}"/>`; }
  if (STATE.drag && STATE.drag.type === 'create' && STATE.drag.cur) { const m = rectOf(STATE.drag.start, STATE.drag.cur); h += shapeEl({ ...m, shape: STATE.drag.shape, radius: 24 }, `fill="${STATE.C.sel}" fill-opacity=".12" stroke="${STATE.C.selSoft}" stroke-width="${sw}" stroke-dasharray="${4 / k} ${3 / k}"`); }
  if (STATE.drag && STATE.drag.type === 'connect' && STATE.drag.cur) {
    const a = find(STATE.drag.from), tg = STATE.drag.target && find(STATE.drag.target);
    if (tg) h += glowFor(tg);
    const pts = tg ? route(a, tg) : (() => { const s = anchor(a, STATE.drag.side), c = STATE.drag.cur; return SIDES[STATE.drag.side][0] ? [s, { x: c.x, y: s.y }, c] : [s, { x: s.x, y: c.y }, c]; })();
    h += `<path d="${pathD(pts, 14)}" fill="none" stroke="${STATE.C.sel}" stroke-width="2" stroke-dasharray="${6 / k} ${4 / k}" marker-end="url(#arS)" pointer-events="none"/>`;
  }
  STATE.gUI.innerHTML = h;
}
export function glowFor(tg) {
  const k = STATE.view.k, o = 7 / k, B = { ...tg, x: tg.x - o, y: tg.y - o, w: tg.w + 2 * o, h: tg.h + 2 * o, radius: tg.radius + o };
  return `<g class="an an-glow" style="animation-delay:-${Math.round(now() - STATE.drag.targetT0)}ms" pointer-events="none">${shapeEl(B, `fill="none" stroke="${STATE.C.sel}" stroke-opacity=".25" stroke-width="${7 / k}"`)}${shapeEl(B, `fill="none" stroke="${STATE.C.selSoft}" stroke-width="${1.7 / k}"`)}</g>`;
}
export const unionBox = bs => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const b of bs) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); } return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
export function applyView() {
  STATE.world.setAttribute('transform', `translate(${STATE.view.x} ${STATE.view.y}) scale(${STATE.view.k})`);
  $('#zoomv').textContent = Math.round(STATE.view.k * 100) + '%';
  drawUI(); if (STATE.editing) placeEditor(); scheduleSave();
}
export const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initRender() {
  STATE.rafS = 0;
}
