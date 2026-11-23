// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { RM, anim, now } from './dom';
import { toast } from './help';
import { inkSVG } from './ink';
import { physAfter } from './physics';
import { render, unionBox } from './render';
import { edgeSVG } from './routing';
import { nodeSVG, textItemSVG } from './shapes';
import { find, isEdge, isInk, isNode, normalize, snap, uid } from './state-init';
import { commit } from './storage';
import { bbox, fitNode } from './text';
import { MSG } from './strings';

// ---------- selection ops ----------
export const selObjs = () => [...STATE.sel].map(find).filter(Boolean);
export function mutate(fn) { const pre = snap(); fn(); commit(pre); }
export function del() {
  if (!STATE.sel.size) return;
  if (!RM) {
    const t0 = now(), ids = new Set(STATE.sel), gone = id => ids.has(id) && !find(id).locked;
    for (const e of STATE.doc.edges) if (ids.has(e.id) || gone(e.from) || gone(e.to)) STATE.ghosts.push({ html: edgeSVG(e, true), t0 });
    for (const it of STATE.doc.items) if (gone(it.id)) STATE.ghosts.push({ html: isNode(it) ? nodeSVG(it, true) : isInk(it) ? inkSVG(it, true) : textItemSVG(it, true), t0 });
    setTimeout(render, 250);
  }
  mutate(() => {
    const ids = new Set(STATE.sel);
    STATE.doc.items = STATE.doc.items.filter(i => !ids.has(i.id) || i.locked);
    STATE.doc.edges = STATE.doc.edges.filter(e => !ids.has(e.id) && find(e.from) && find(e.to));
    STATE.sel = new Set([...STATE.sel].filter(id => find(id)));
  });
}
export function copy() {
  const items = selObjs().filter(o => !isEdge(o)); if (!items.length) return false;
  const ids = new Set(items.map(i => i.id));
  STATE.clip = JSON.stringify({ items, edges: STATE.doc.edges.filter(e => ids.has(e.from) && ids.has(e.to)) }); STATE.pasteN = 0;
  try { localStorage.setItem('flowspace.clip', STATE.clip); } catch (e: any) { }
  return true;
}
export function paste() {
  let c = STATE.clip; if (!c) try { c = localStorage.getItem('flowspace.clip'); } catch (e: any) { }
  if (!c) return; const o = JSON.parse(c); STATE.pasteN++;
  mutate(() => {
    const map = {}, gmap = {}, off = 24 * STATE.pasteN; STATE.sel = new Set();
    for (const it of o.items) { const n = { ...it, id: uid(it.type === 'text' ? 't' : it.type === 'ink' ? 'k' : 'n'), x: it.x + off, y: it.y + off, locked: false }; if (it.g) n.g = gmap[it.g] || (gmap[it.g] = uid('g')); map[it.id] = n.id; STATE.doc.items.push(n); STATE.sel.add(n.id); STATE.prevSel.add(n.id); anim(n.id, 'pop', 300); }
    for (const e of o.edges) { const id = uid('e'); STATE.doc.edges.push({ ...e, id, from: map[e.from], to: map[e.to] }); anim(id, 'draw', 360); }
    setTimeout(render, 380);
  });
  physAfter([...STATE.sel]);
}
export function pasteText(t) {
  const r = STATE.svg.getBoundingClientRect(), c = { x: (r.width / 2 - STATE.view.x) / STATE.view.k, y: (r.height / 2 - STATE.view.y) / STATE.view.k };
  mutate(() => { const it = normalize({ id: uid('t'), type: 'text', x: Math.round(c.x - 160), y: Math.round(c.y - 20), w: 320, text: t }); STATE.doc.items.push(it); STATE.sel = new Set([it.id]); STATE.prevSel.add(it.id); anim(it.id, 'pop', 300); });
  toast(MSG.pastedAsATextBox);
}
export function expandGroups(set) {
  const gs = new Set(); for (const id of set) { const o = find(id); if (o && o.g) gs.add(o.g); }
  if (gs.size) for (const it of STATE.doc.items) if (it.g && gs.has(it.g)) set.add(it.id);
  return set;
}
export function groupSel() {
  const objs = selObjs().filter(o => !isEdge(o)); if (objs.length < 2) { toast(MSG.selectAtLeast2Objects); return; }
  const gid = uid('g'); mutate(() => objs.forEach(o => o.g = gid)); toast(`Grouped ${objs.length} objects`);
}
export function ungroupSel() {
  const objs = selObjs().filter(o => o.g); if (!objs.length) { toast(MSG.nothingInTheSelectionIs); return; }
  mutate(() => objs.forEach(o => { delete o.g; })); toast(MSG.ungrouped);
}
export function arrange(kind) {
  const m = new Map();
  for (const o of selObjs().filter(o => !isEdge(o))) { const key = o.g || o.id; if (!m.has(key)) m.set(key, []); m.get(key).push(o); }
  const U = [...m.values()].map(list => ({ list, b: unionBox(list.map(bbox)), locked: list.some(o => o.locked) }));
  const dist = kind === 'dh' || kind === 'dv';
  if (U.length < (dist ? 3 : 2)) { toast(dist ? 'Distribute needs at least 3 objects' : 'Select at least 2 objects'); return; }
  const A = unionBox(U.map(u => u.b));
  mutate(() => {
    const mv = (u, dx, dy) => { if (u.locked || (!dx && !dy)) return; u.list.forEach(o => { o.x = Math.round(o.x + dx); o.y = Math.round(o.y + dy); anim(o.id, 'settle', 300); }); };
    for (const u of U) {
      if (kind === 'l') mv(u, A.x - u.b.x, 0);
      if (kind === 'ch') mv(u, A.x + A.w / 2 - (u.b.x + u.b.w / 2), 0);
      if (kind === 'r') mv(u, A.x + A.w - (u.b.x + u.b.w), 0);
      if (kind === 't') mv(u, 0, A.y - u.b.y);
      if (kind === 'cv') mv(u, 0, A.y + A.h / 2 - (u.b.y + u.b.h / 2));
      if (kind === 'b') mv(u, 0, A.y + A.h - (u.b.y + u.b.h));
    }
    if (dist) {
      const H = kind === 'dh', P = b => H ? b.x : b.y, S = b => H ? b.w : b.h;
      const s2 = [...U].sort((a, b) => (P(a.b) + S(a.b) / 2) - (P(b.b) + S(b.b) / 2));
      const span = P(s2[s2.length - 1].b) + S(s2[s2.length - 1].b) - P(s2[0].b), sum = s2.reduce((t, u) => t + S(u.b), 0), gap = (span - sum) / (s2.length - 1);
      let pos = P(s2[0].b);
      for (const u of s2) { const d = pos - P(u.b); H ? mv(u, d, 0) : mv(u, 0, d); pos += S(u.b) + gap; }
    }
  });
}
export const STYLE_KEYS = { node: ['shape', 'fill', 'border', 'shadow', 'radius', 'color', 'bold', 'fs', 'align', 'valign', 'fit'], text: ['color', 'bold', 'fs', 'align'], ink: ['color', 'sw', 'pen'], edge: ['style', 'arrow'] };
export const kindOf = o => isEdge(o) ? 'edge' : o.type;
export function copyStyle() {
  const o = selObjs()[0]; if (!o) return false; const k = kindOf(o);
  STATE.styleClip = { kind: k, v: Object.fromEntries(STYLE_KEYS[k].filter(x => o[x] !== undefined).map(x => [x, o[x]])) }; return true;
}
export function applyStyleTo(o) {
  if (!STATE.styleClip || !o) return false;
  const k = kindOf(o), src = STATE.styleClip;
  const keys = src.kind === k ? STYLE_KEYS[k] : (['node', 'text'].includes(k) && ['node', 'text'].includes(src.kind)) ? STYLE_KEYS.text : (src.v.color && k !== 'edge') ? ['color'] : null;
  if (!keys) return false;
  for (const x of keys) if (src.v[x] !== undefined) o[x] = src.v[x];
  fitNode(o); return true;
}
export function pasteStyle() {
  if (!STATE.styleClip) { toast(MSG.copyAStyleFirst); return; }
  const objs = selObjs(); if (!objs.length) return;
  mutate(() => objs.forEach(applyStyleTo)); toast(MSG.stylePasted);
}
export function startBrush() { if (!copyStyle()) return; STATE.painter = true; STATE.app.classList.add('painter'); toast(MSG.formatPainterClickAnObject); }
export function stopBrush() { STATE.painter = false; STATE.app.classList.remove('painter'); }
export function reorder(how) {
  mutate(() => {
    const arr = STATE.doc.items, s = it => STATE.sel.has(it.id);
    if (how === 'top') STATE.doc.items = [...arr.filter(i => !s(i)), ...arr.filter(s)];
    else if (how === 'bottom') STATE.doc.items = [...arr.filter(s), ...arr.filter(i => !s(i))];
    else {
      const a = [...arr], dir = how === 'up' ? 1 : -1, idx = a.map((it, i) => s(it) ? i : -1).filter(i => i >= 0);
      if (dir > 0) idx.reverse();
      for (const i of idx) { let j = i + dir; while (j >= 0 && j < a.length && a[j].type !== a[i].type) j += dir; if (j >= 0 && j < a.length && !s(a[j])) { [a[i], a[j]] = [a[j], a[i]]; } }
      STATE.doc.items = a;
    }
  });
}
