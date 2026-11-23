// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { THEMES } from './themes';
import { closeMenus, setBg } from './chrome';
import { $, RM, anims } from './dom';
import { closeEditor } from './editing';
import { toast } from './help';
import { renderPanel } from './panel';
import { physStop, renderPhys } from './physics';
import { fitView } from './pointer';
import { applyView, draw, render } from './render';
import { esc, find, normalize, sample, snap, uid } from './state-init';
import { canvasBg, palOf } from './theme';
import { MSG } from './strings';

// ---------- history & persistence ----------
export function commit(pre) { STATE.undoS.push(pre); if (STATE.undoS.length > 200) STATE.undoS.shift(); STATE.redoS = []; changed(); }
export function changed() { render(); renderPanel(); scheduleSave(); $('#undo').disabled = !STATE.undoS.length; $('#redo').disabled = !STATE.redoS.length; }
export function restore(s) { const o = JSON.parse(s); STATE.doc.items = o.items; STATE.doc.edges = o.edges; for (const id of [...STATE.sel]) if (!find(id)) STATE.sel.delete(id); }
export function undo() { if (!STATE.undoS.length) return; closeEditor(); physStop(); STATE.redoS.push(snap()); restore(STATE.undoS.pop()); changed(); }
export function redo() { if (!STATE.redoS.length) return; closeEditor(); physStop(); STATE.undoS.push(snap()); restore(STATE.redoS.pop()); changed(); }
export const mem = {};
export const sget = k => { try { const v = localStorage.getItem(k); if (v != null) return v; } catch (e: any) { } return mem[k] ?? null; };
export const sset = (k, v) => { mem[k] = v; try { localStorage.setItem(k, v); return true; } catch (e: any) { return false; } };
export const sdel = k => { delete mem[k]; try { localStorage.removeItem(k); } catch (e: any) { } };
export const saveIndex = () => sset('flowspace.index', JSON.stringify(STATE.index));
export function saveNow() {
  if (!STATE.curId) return true;
  const ok = sset('flowspace.doc.' + STATE.curId, JSON.stringify({ doc: STATE.doc, view: STATE.view }));
  const ent = STATE.index.list.find(x => x.id === STATE.curId); if (ent) { ent.name = STATE.doc.name; ent.updated = Date.now(); }
  saveIndex(); return ok;
}
export function scheduleSave() {
  $('#status').classList.add('busy'); $('#status span').textContent = 'Saving…';
  clearTimeout(STATE.saveT); STATE.saveT = setTimeout(() => {
    $('#status span').textContent = saveNow() ? 'Saved locally' : 'Not saved (storage unavailable)';
    $('#status').classList.remove('busy');
  }, 400);
}
export const blankDoc = (name?) => ({ name: name || 'Untitled canvas', bg: (STATE.doc && STATE.doc.bg) || 'blue', theme: (STATE.doc && STATE.doc.theme) || 'mist', edgeDef: { style: 'orth', arrow: 'end' }, phys: { on: false, strength: 50, gap: 24 }, items: [], edges: [] });
export function normDoc(d) {
  d.items = (d.items || []).map(normalize); d.edges = (d.edges || []).filter(x => x.from && x.to);
  d.phys = Object.assign({ on: false, strength: 50, gap: 24 }, d.phys || {}); d.edgeDef = Object.assign({ style: 'orth', arrow: 'end' }, d.edgeDef || {});
  d.bg = d.bg === 'white' || d.bg === 'dark' ? d.bg : 'blue'; d.theme = THEMES[d.theme] ? d.theme : 'mist'; d.name = d.name || 'Untitled canvas'; return d;
}
export function readCanvas(id) { try { const o = JSON.parse(sget('flowspace.doc.' + id)); if (o && o.doc && Array.isArray(o.doc.items)) return o; } catch (e: any) { } return null; }
export function openCanvas(id, boot?) {
  if (!boot && STATE.curId) { closeEditor(); physStop(); clearTimeout(STATE.saveT); saveNow(); }
  const o = readCanvas(id) || { doc: blankDoc(), view: null };
  STATE.curId = id; STATE.index.current = id; saveIndex();
  STATE.doc = normDoc(o.doc); STATE.undoS = []; STATE.redoS = []; STATE.sel = new Set(); STATE.prevSel = new Set(); anims.clear(); STATE.ghosts = []; STATE.hoverId = null; STATE.drag = null; STATE.pendingDel = null;
  $('#fname').value = STATE.doc.name; document.title = STATE.doc.name + ' · FlowSpace';
  setBg(STATE.doc.bg); renderPhys(); draw(); changed();
  if (o.view && o.view.k) { STATE.view = o.view; applyView(); } else requestAnimationFrame(() => fitView(false));
  if (!boot && !RM) { STATE.world.style.animation = 'none'; requestAnimationFrame(() => { STATE.world.style.animation = 'k-fade .3s ease-out'; }); }
}
export function uniqueName(base) { const names = new Set(STATE.index.list.map(x => x.name)); if (!names.has(base)) return base; let i = 2; while (names.has(base + ' ' + i)) i++; return base + ' ' + i; }
export function newCanvas(fromDoc?, label?) {
  closeMenus(); if (STATE.curId) { closeEditor(); saveNow(); }
  const id = uid('c'), d = fromDoc || blankDoc(); d.name = uniqueName(fromDoc ? d.name : 'Untitled canvas');
  STATE.index.list.push({ id, name: d.name, updated: Date.now() });
  sset('flowspace.doc.' + id, JSON.stringify({ doc: d, view: null }));
  openCanvas(id); toast(label || `Created “${d.name}”`);
}
export function dupCanvas(id) {
  if (id === STATE.curId) saveNow();
  const o = readCanvas(id); if (!o) return;
  const d = JSON.parse(JSON.stringify(o.doc)); d.name = d.name + ' copy'; newCanvas(d, `Duplicated as “${uniqueName(d.name)}”`);
}
export function deleteCanvas(id) {
  if (STATE.index.list.length < 2) { toast(MSG.keepAtLeastOneCanvas); return; }
  const ent = STATE.index.list.find(x => x.id === id); STATE.index.list = STATE.index.list.filter(x => x.id !== id); sdel('flowspace.doc.' + id); STATE.pendingDel = null;
  if (id === STATE.curId) { STATE.curId = null; const next = [...STATE.index.list].sort((a, b) => b.updated - a.updated)[0]; openCanvas(next.id, true); if (!RM) { STATE.world.style.animation = 'none'; requestAnimationFrame(() => { STATE.world.style.animation = 'k-fade .3s ease-out'; }); } }
  else saveIndex();
  renderFiles(); toast(`Deleted “${ent ? ent.name : ''}”`);
}
export function relTime(t) {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + ' min ago'; if (d < 86400) return Math.floor(d / 3600) + ' h ago';
  return new Date(t).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
export function thumbSVG(d) {
  const P = palOf(d), bg = d ? canvasBg(d) : P.cbg, its = (d && d.items) || [];
  if (!its.length) return `<svg class="th" viewBox="0 0 58 40"><rect width="58" height="40" fill="${bg}"/></svg>`;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of its) { const h = it.type === 'text' ? 30 : it.h; x0 = Math.min(x0, it.x); y0 = Math.min(y0, it.y); x1 = Math.max(x1, it.x + it.w); y1 = Math.max(y1, it.y + h); }
  const sc = Math.min(48 / (x1 - x0 || 1), 30 / (y1 - y0 || 1)), ox = (58 - (x1 - x0) * sc) / 2, oy = (40 - (y1 - y0) * sc) / 2;
  const F = {}; for (const k in P.f) F[k] = k === 'white' ? P.f.white[0] : P.f[k][1];
  return `<svg class="th" viewBox="0 0 58 40"><rect width="58" height="40" fill="${bg}"/>` + its.map(it => {
    const x = ox + (it.x - x0) * sc, y = oy + (it.y - y0) * sc, w = Math.max(1.5, it.w * sc);
    if (it.type === 'text') return `<rect x="${x}" y="${y + 1}" width="${w * .8}" height="1.6" rx=".8" fill="${P.ink2}"/>`;
    if (it.type === 'ink') return `<path d="M${x},${y + it.h * sc * .6}q${w / 4},${-it.h * sc * .5} ${w / 2},0t${w / 2},0" fill="none" stroke="${P.ink2}" stroke-width=".9"/>`;
    const h = Math.max(1.5, it.h * sc), rx = it.shape === 'circle' || it.shape === 'capsule' ? Math.min(w, h) / 2 : Math.min(3, h / 3);
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${F[it.fill] || it.fill || P.f.white[0]}" stroke="${P.f.white[2]}" stroke-width=".5"/>`;
  }).join('') + '</svg>';
}
export function renderFiles() {
  if (STATE.curId) saveNow();
  const list = [...STATE.index.list].sort((a, b) => b.updated - a.updated);
  const IC_DUP = '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg>';
  const IC_DEL = '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>';
  $('#mFiles').innerHTML = `<div class="mh"><b>My canvases</b><span>${list.length} · stored in this browser</span></div>
  <button class="newc" data-f="new">＋ New canvas<small>Alt N</small></button><hr>` + list.map(x => {
    if (STATE.pendingDel === x.id) return `<div class="fconf">Delete “${esc(x.name)}”? This can’t be undone.<div><button class="y" data-delyes="${x.id}">Delete</button><button class="n" data-delno="1">Cancel</button></div></div>`;
    const o = readCanvas(x.id);
    return `<div class="frow ${x.id === STATE.curId ? 'cur' : ''}" data-open="${x.id}">${thumbSVG(o && o.doc)}<div class="fi"><div class="fn">${esc(x.name)}</div><div class="ft">${x.id === STATE.curId ? 'Current · ' : ''}${relTime(x.updated)} · ${o ? o.doc.items.filter(i => i.type === 'node').length : 0} nodes</div></div>
      <button class="ib" data-dup="${x.id}" title="Duplicate canvas">${IC_DUP}</button><button class="ib" data-delc="${x.id}" title="Delete">${IC_DEL}</button></div>`;
  }).join('');
}
export function load() {
  try { STATE.index = JSON.parse(sget('flowspace.index')); } catch (e: any) { STATE.index = null; }
  if (!STATE.index || !Array.isArray(STATE.index.list) || !STATE.index.list.length) {
    STATE.index = { current: null, list: [] };
    let old = null; try { old = JSON.parse(sget('flowspace.v1')); } catch (e: any) { }
    const id = uid('c'), d = old && old.doc && Array.isArray(old.doc.items) ? old.doc : sample();
    STATE.index.list.push({ id, name: d.name || 'Untitled canvas', updated: Date.now() }); STATE.index.current = id;
    sset('flowspace.doc.' + id, JSON.stringify({ doc: d, view: old && old.view || null })); saveIndex();
  }
  const id = STATE.index.list.some(x => x.id === STATE.index.current) ? STATE.index.current : STATE.index.list[0].id;
  openCanvas(id, true);
}

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initStorage() {
  STATE.saveT = 0;
  STATE.curId = null;
  STATE.index = { current: null, list: [] };
  STATE.pendingDel = null;
}
