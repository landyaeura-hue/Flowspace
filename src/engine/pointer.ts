// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { DEF_SIZE, LH, TEXT_FS } from './constants';
import { closeMenus } from './chrome';
import { inside, nodeAt, toWorld } from './coords';
import { $, RM, anim, now } from './dom';
import { closeEditor, openEditor } from './editing';
import { snapMove } from './guides';
import { toast } from './help';
import { finishInk, inkAbs, inkSVG } from './ink';
import { renderPanel, renderPanelNums } from './panel';
import { phys, physAfter, physKick, physOn } from './physics';
import { quickAdd } from './quick-extend';
import { applyView, draw, drawUI, rectOf, render } from './render';
import { SIDES, anchor, newEdge } from './routing';
import { applyStyleTo, copy, del, expandGroups, groupSel, paste, pasteStyle, reorder, selObjs, startBrush, stopBrush, ungroupSel } from './selection';
import { find, isEdge, isInk, isNode, isText, normalize, snap, touches, uid } from './state-init';
import { changed, commit, restore } from './storage';
import { TPX, TPY, bbox, fitNode } from './text';
import { MSG } from './strings';

// ---------- pointer interaction ----------
export function setTool(t) {
  STATE.tool = t; closeEditor(); if (STATE.painter) stopBrush();
  document.querySelectorAll<HTMLInputElement>('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  STATE.app.className = STATE.app.className.replace(/\bt-\w+/g, '') + ' t-' + (DEF_SIZE[t] ? 'shape' : t);
  drawUI(); if (STATE.doc) renderPanel();
}
export function startPinch() {
  clearLP();
  if (STATE.drag) {
    if ((STATE.drag.type === 'move' || STATE.drag.type === 'resize') && STATE.drag.moved) { restore(STATE.drag.pre); }
    STATE.drag = null; STATE.app.classList.remove('grabbing');
  }
  const [a, b] = [...touches.values()];
  STATE.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: { ...STATE.view } };
  cancelAnimationFrame(STATE.viewAnim); draw();
}
export function doPinch() {
  const [a, b] = [...touches.values()]; if (!a || !b) return;
  const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, r = STATE.svg.getBoundingClientRect(), v0 = STATE.pinch.v0;
  const k = Math.min(4, Math.max(.1, v0.k * d / STATE.pinch.d0)), wx = (STATE.pinch.m0.x - r.left - v0.x) / v0.k, wy = (STATE.pinch.m0.y - r.top - v0.y) / v0.k;
  STATE.view = { k, x: m.x - r.left - wx * k, y: m.y - r.top - wy * k }; applyView();
}
export const panDrag = e => ({ type: 'pan', sx: e.clientX, sy: e.clientY, vx: STATE.view.x, vy: STATE.view.y });
export function eraseAt(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest<HTMLInputElement>('[data-id]'), it = t && find(t.dataset.id);
  if (isInk(it) && !it.locked) { STATE.ghosts.push({ html: inkSVG(it, true), t0: now() }); STATE.doc.items = STATE.doc.items.filter(i => i !== it); STATE.sel.delete(it.id); STATE.drag.n++; render(); setTimeout(render, 250); }
}
export function endDrag(e) {
  if (!STATE.drag) return;
  const d = STATE.drag; STATE.drag = null; STATE.hoverId = null; STATE.dragPid = null; STATE.app.classList.remove('grabbing');
  if (d.type === 'ink') { if (d.raw) d.pts.push(d.raw); finishInk(d); return; }
  if (d.type === 'lasso') { finishLasso(d, e); return; }
  if (d.type === 'erase') { if (d.n) commit(d.pre); return; }
  if (d.type === 'reconnect') {
    const e2 = find(d.eid);
    if (e2 && d.target && d.target !== e2[d.end]) {
      const nf = d.end === 'from' ? d.target : e2.from, nt = d.end === 'to' ? d.target : e2.to;
      if (STATE.doc.edges.some(x => x !== e2 && x.from === nf && x.to === nt)) { anim(d.target, 'nope', 400); toast(MSG.theseTwoNodesAreAlready); render(); }
      else { e2[d.end] = d.target; anim(d.target, 'settle', 300); commit(d.pre); toast(MSG.connectorReconnected); }
    } else render();
    return;
  }
  if (d.type === 'move') {
    if (d.moved && Object.keys(d.orig).length) {
      for (const id in d.orig) anim(id, 'settle', 300);
      if (physOn()) { phys.pre = phys.pre || d.pre; phys.frames = 0; physKick(); render(); } else commit(d.pre);
    }
    else if (!d.moved && d.multi) { STATE.sel = expandGroups(new Set([d.clickId])); changed(); }
  } else if (d.type === 'resize') { if (d.moved) { if (physOn() && phys.fixed.size) { phys.pre = phys.pre || d.pre; phys.frames = 0; physKick(); } else commit(d.pre); } }
  else if (d.type === 'marquee') { changed(); }
  else if (d.type === 'create') {
    const pre = snap(); let b = d.cur ? rectOf(d.start, d.cur) : null;
    if (!b || b.w * STATE.view.k < 8 || b.h * STATE.view.k < 8) { const [w, h] = DEF_SIZE[d.shape]; b = { x: d.start.x - w / 2, y: d.start.y - h / 2, w, h }; }
    else { b.w = Math.max(40, b.w); b.h = Math.max(30, b.h); }
    const n = normalize({ id: uid('n'), type: 'node', shape: d.shape, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) });
    STATE.doc.items.push(n); STATE.sel = new Set([n.id]); STATE.prevSel.add(n.id); anim(n.id, 'pop', 300); setTool('select'); commit(pre); physAfter([n.id]);
  } else if (d.type === 'connect') {
    const pre = snap(), a = find(d.from);
    if (d.target) {
      if (!STATE.doc.edges.some(x => x.from === d.from && x.to === d.target)) { const ed2 = newEdge(d.from, d.target); STATE.doc.edges.push(ed2); STATE.sel = new Set([ed2.id]); anim(ed2.id, 'draw', 360); anim(d.target, 'settle', 300); setTimeout(render, 380); commit(pre); }
      else { anim(d.target, 'nope', 400); toast(MSG.theseTwoNodesAreAlready); render(); }
    } else if (a && d.sp && d.cur && Math.hypot(d.cur.x - d.sp.x, d.cur.y - d.sp.y) * STATE.view.k < 6) { quickAdd(a, d.side, a);
    } else if (a && d.cur && inside(d.cur, a)) { anim(a.id, 'nope', 400); render();
    } else if (d.cur && a && Math.hypot(d.cur.x - anchor(a, d.side).x, d.cur.y - anchor(a, d.side).y) > 40) {
      const [sx, sy] = SIDES[d.side];
      const n = normalize({ id: uid('n'), type: 'node', shape: a.shape, fill: a.fill, radius: a.radius, border: a.border, shadow: a.shadow, w: a.w, h: a.h, x: Math.round(d.cur.x - (sx ? (sx > 0 ? 0 : a.w) : a.w / 2)), y: Math.round(d.cur.y - (sy ? (sy > 0 ? 0 : a.h) : a.h / 2)) });
      const ne = newEdge(a.id, n.id), eid = ne.id; STATE.doc.items.push(n); STATE.doc.edges.push(ne);
      anim(n.id, 'pop', 300); anim(eid, 'draw', 360); setTimeout(render, 380);
      if (STATE.tool === 'conn') setTool('select');
      openEditor(n.id, pre);
    } else drawUI();
  } else drawUI();
}
export function onUp(e) {
  clearLP();
  if (touches.has(e.pointerId)) { touches.delete(e.pointerId); if (STATE.pinch) { if (!touches.size) STATE.pinch = null; return; } }
  if (STATE.pinch) return;
  if (STATE.drag && STATE.dragPid !== null && e.pointerId !== STATE.dragPid) return;
  endDrag(e);
}
export function clearLP() { if (STATE.lp) { clearTimeout(STATE.lp.t); const had = STATE.lp.ring; STATE.lp = null; if (had) drawUI(); } }
export function onLongPress() {
  if (!STATE.lp) return; const L = STATE.lp;
  const d = STATE.drag;
  if (d && d.type === 'move' && !d.moved) {           // held on an object → menu
    STATE.drag = null; STATE.lp = null; showCtx(L.x, L.y); return;
  }
  if (d && (d.type === 'pan' || (d.type === 'ink' && d.pts.length < 4))) {   // held on empty → lasso
    STATE.drag = { type: 'lasso', pts: [[L.p.x, L.p.y]], menu: true, held: true, pre: null };
    STATE.sel.clear(); changed(); STATE.lp.ring = true; drawUI();
    setTimeout(() => { if (STATE.lp === L) { STATE.lp.ring = false; drawUI(); } }, 520);
    toast(MSG.lassoDrawAroundWhatYou); return;
  }
  STATE.lp = null;
}
export function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi) c = !c; } return c; }
export function finishLasso(d, e) {
  const P = d.pts;
  if (P.length < 3) { if (d.held || d.menu) showCtx(e.clientX, e.clientY); else changed(); return; }
  const hit = new Set();
  for (const it of STATE.doc.items) {
    if (isInk(it)) { const A = inkAbs(it); let tot = 0, inn = 0; for (const st of A.strokes) for (let i = 0; i < st.length; i += 3) { tot++; if (inPoly(st[i][0], st[i][1], P)) inn++; } if (tot && inn / tot >= .5) hit.add(it.id); continue; }
    const b = bbox(it); let c = 0;
    for (const [u, v] of [[.5, .5], [.15, .15], [.85, .15], [.15, .85], [.85, .85], [.5, .15], [.5, .85], [.15, .5], [.85, .5]]) if (inPoly(b.x + b.w * u, b.y + b.h * v, P)) c++;
    if (c >= 5 || (c && inPoly(b.x + b.w / 2, b.y + b.h / 2, P) && c >= 3)) hit.add(it.id);
  }
  STATE.sel = expandGroups(hit); changed();
  if (!STATE.sel.size) { toast(MSG.nothingInsideTheLasso); return; }
  if (STATE.tool === 'lasso' && !d.menu) setTool('select');
  if (d.menu) showCtx(e.clientX, e.clientY);
}
export function showCtx(cx, cy) {
  const objs = selObjs(), items = objs.filter(o => !isEdge(o)), grouped = items.length && new Set(items.map(o => o.g || o.id)).size === 1 && items.every(o => o.g);
  const B = (c, t, kb?, cls?) => `<button data-c="${c}" class="${cls || ''}">${t}${kb ? `<span class="kb">${kb}</span>` : ''}</button>`;
  let h;
  if (!objs.length) h = B('paste', 'Paste', STATE.MK + ' V') + B('selall', 'Select all', STATE.MK + ' A') + '<hr>' + B('lasso', 'Lasso select', 'Q') + B('pen', 'Pen', 'B');
  else {
    h = B('copy', 'Copy', STATE.MK + ' C') + B('cut', 'Cut', STATE.MK + ' X') + (STATE.clip ? B('paste', 'Paste', STATE.MK + ' V') : '') + B('dup', 'Duplicate', STATE.MK + ' D') + '<hr>';
    if (items.length >= 2) h += grouped ? B('ungroup', 'Ungroup', STATE.MK + ' ⇧ G') : B('group', 'Group', STATE.MK + ' G');
    else if (items.some(o => o.g)) h += B('ungroup', 'Ungroup', STATE.MK + ' ⇧ G');
    h += B('brush', 'Format painter') + (STATE.styleClip ? B('pstyle', 'Paste style', STATE.MK + ' ⌥ V') : '');
    if (items.length === 1 && !isInk(items[0])) h += B('edit', 'Edit text', 'Enter');
    if (objs.length === 1 && isEdge(objs[0])) h += B('edit', objs[0].label ? 'Edit label' : 'Add label');
    h += '<hr>' + B('top', 'Bring to front') + B('bottom', 'Send to back') + B('del', 'Delete', 'Delete', 'dz');
  }
  closeMenus();
  const m = $('#ctx'); m.innerHTML = h; m.classList.add('show');
  const r = STATE.app.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(cx + 10, r.width - mw - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(cy + 10, r.height - mh - 8)) + 'px';
  STATE.ctxAt = now();
}
export function onDouble(e, p, tgt) {
  const it = tgt && tgt.dataset.id && find(tgt.dataset.id);
  if (isInk(it)) return;
  if (it) { openEditor(it.id); return; }
  { const pre = snap(); const t = normalize({ id: uid('t'), type: 'text', x: p.x - TPX, y: p.y - TEXT_FS * LH / 2 - TPY, w: 240, text: '' }); STATE.doc.items.push(t); anim(t.id, 'pop', 300); openEditor(t.id, pre); }
}
export function tweenView(fn, dur = 300) {
  cancelAnimationFrame(STATE.viewAnim);
  if (RM) { fn(1); applyView(); return; }
  const t0 = now();
  const step = () => { const t = Math.min(1, (now() - t0) / dur); fn(1 - Math.pow(1 - t, 3)); applyView(); if (t < 1) STATE.viewAnim = requestAnimationFrame(step); };
  STATE.viewAnim = requestAnimationFrame(step);
}
export function zoomTo(k1) {
  const r = STATE.svg.getBoundingClientRect(), sx = r.width / 2, sy = r.height / 2, v0 = { ...STATE.view };
  k1 = Math.min(4, Math.max(.1, k1)); const wx = (sx - v0.x) / v0.k, wy = (sy - v0.y) / v0.k;
  tweenView(e => { const k = v0.k + (k1 - v0.k) * e; STATE.view = { k, x: sx - wx * k, y: sy - wy * k }; }, 260);
}
export function zoomAt(cx, cy, f) {
  cancelAnimationFrame(STATE.viewAnim);
  const k = Math.min(4, Math.max(.1, STATE.view.k * f)), r = STATE.svg.getBoundingClientRect(), sx = cx - r.left, sy = cy - r.top;
  STATE.view.x = sx - (sx - STATE.view.x) * k / STATE.view.k; STATE.view.y = sy - (sy - STATE.view.y) * k / STATE.view.k; STATE.view.k = k; applyView();
}
export function fitView(smooth) {
  const r = STATE.svg.getBoundingClientRect();
  if (!STATE.doc.items.length) { STATE.view = { x: r.width / 2, y: r.height / 2, k: 1 }; applyView(); return; }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const it of STATE.doc.items) { const b = bbox(it); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  const narrow = r.width < 760, pl = narrow ? 24 : 96, pr = narrow ? 24 : (STATE.panel.classList.contains('show') ? 300 : 60), pt = 90, pb = narrow ? 150 : 90;
  const aw = Math.max(120, r.width - pl - pr), ah = Math.max(120, r.height - pt - pb);
  const k = Math.min(1.4, Math.max(.1, Math.min(aw / (x1 - x0), ah / (y1 - y0))));
  const to = { k, x: pl + aw / 2 - (x0 + x1) / 2 * k, y: pt + ah / 2 - (y0 + y1) / 2 * k };
  if (!smooth) { STATE.view = to; applyView(); return; }
  const v0 = { ...STATE.view }; tweenView(e => { STATE.view = { k: v0.k + (to.k - v0.k) * e, x: v0.x + (to.x - v0.x) * e, y: v0.y + (to.y - v0.y) * e }; }, 380);
}

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initPointer() {
  STATE.svg.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (e.pointerType === 'pen') STATE.penSeen = true;
    if (e.pointerType === 'touch') { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size >= 2) { startPinch(); return; } }
    if (STATE.pinch) return;
    STATE.dragPid = e.pointerId;
    const ae = document.activeElement; if (ae && ae !== document.body && ae !== STATE.ed && ae !== STATE.svg) (ae as HTMLElement).blur();
    try { STATE.svg.focus({ preventScroll: true }); } catch (er: any) { }
    if (STATE.editing) closeEditor();
    closeMenus();
    const p = toWorld(e), tgt = (e.target as HTMLInputElement).closest<HTMLInputElement>('[data-id],[data-handle],[data-conn],[data-eend]');
    try { STATE.svg.setPointerCapture(e.pointerId); } catch (er: any) { }
    cancelAnimationFrame(STATE.viewAnim);
    if (e.button === 1 || STATE.tool === 'hand' || STATE.spaceDown) { STATE.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: STATE.view.x, vy: STATE.view.y }; STATE.app.classList.add('grabbing'); return; }
    if (e.pointerType === 'pen' && (e.buttons & 32)) { STATE.drag = { type: 'erase', pre: snap(), n: 0 }; eraseAt(e); return; }
    if (e.button !== 0) return;
    if (STATE.painter) {
      const it = tgt && tgt.dataset.id && find(tgt.dataset.id);
      if (it) { const pre = snap(); if (applyStyleTo(it)) { anim(it.id, 'settle', 300); commit(pre); toast(MSG.styleApplied); } else toast(MSG.thoseStylesDonTMatch); }
      stopBrush(); return;
    }
    const inkStart = () => { STATE.sel.clear(); renderPanel(); STATE.drag = { type: 'ink', pts: [[p.x, p.y, e.pointerType === 'pen' ? Math.max(.08, e.pressure) : .6]], pre: snap(), lt: e.timeStamp, sx: e.clientX, sy: e.clientY, pp: .6 }; drawUI(); };
    // long-press: menu on objects, lasso on empty
    clearLP();
    if (e.pointerType !== 'mouse' && (STATE.tool === 'select' || STATE.tool === 'pen' || STATE.tool === 'lasso')) {
      STATE.lp = { x: e.clientX, y: e.clientY, p, pt: e.pointerType, t: setTimeout(onLongPress, 480) };
    }
    if (STATE.tool === 'lasso' || (STATE.tool === 'select' && e.altKey && !tgt)) { STATE.sel.clear(); changed(); STATE.drag = { type: 'lasso', pts: [[p.x, p.y]], menu: e.pointerType !== 'mouse' }; return; }
    if (STATE.tool === 'pen') { if (e.pointerType === 'touch' && STATE.penSeen) { STATE.drag = panDrag(e); return; } inkStart(); return; }
    if (e.pointerType === 'pen' && STATE.tool === 'select' && (!tgt || isInk(find(tgt.dataset.id)))) { inkStart(); return; }
    const tNow = now(), dbl = STATE.lastDown && tNow - STATE.lastDown.t < 400 && Math.hypot(e.clientX - STATE.lastDown.x, e.clientY - STATE.lastDown.y) < 6;
    STATE.lastDown = dbl ? null : { t: tNow, x: e.clientX, y: e.clientY };
    if (dbl && STATE.tool === 'select' && !(tgt && (tgt.dataset.conn || tgt.dataset.handle))) { onDouble(e, p, tgt); return; }
    if (DEF_SIZE[STATE.tool]) { STATE.drag = { type: 'create', shape: STATE.tool, start: p }; return; }
    if (STATE.tool === 'text') {
      const pre = snap(), t = normalize({ id: uid('t'), type: 'text', x: p.x - TPX, y: p.y - TEXT_FS * LH / 2 - TPY, w: 240, text: '' });
      STATE.doc.items.push(t); anim(t.id, 'pop', 300); setTool('select'); openEditor(t.id, pre); return;
    }
    if (tgt && tgt.dataset.eend) { STATE.drag = { type: 'reconnect', eid: tgt.dataset.edge, end: tgt.dataset.eend, cur: p, pre: snap() }; drawUI(); return; }
    if (tgt && tgt.dataset.conn) { STATE.drag = { type: 'connect', from: tgt.dataset.node, side: tgt.dataset.conn, cur: p, sp: p }; return; }
    if (STATE.tool === 'conn') { const n = nodeAt(p); if (n) { const c = { x: n.x + n.w / 2, y: n.y + n.h / 2 }; STATE.drag = { type: 'connect', from: n.id, side: Math.abs(p.x - c.x) / n.w > Math.abs(p.y - c.y) / n.h ? (p.x > c.x ? 'r' : 'l') : (p.y > c.y ? 'b' : 't'), cur: p }; } else STATE.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: STATE.view.x, vy: STATE.view.y }; return; }
    if (tgt && tgt.dataset.handle) { const it = [...STATE.sel].map(find).find(o => o && !isEdge(o)); if (it) STATE.drag = { type: 'resize', h: tgt.dataset.handle, id: it.id, o: { ...bbox(it) }, start: p, pre: snap() }; return; }
    const id = tgt && tgt.dataset.id, it = id && find(id);
    if (it) {
      const grp = expandGroups(new Set([id]));
      if (e.shiftKey || e.metaKey || e.ctrlKey) { if (STATE.sel.has(id)) grp.forEach(x => STATE.sel.delete(x)); else grp.forEach(x => STATE.sel.add(x)); changed(); if (!STATE.sel.has(id)) return; }
      else if (!STATE.sel.has(id)) { STATE.sel = grp; changed(); }
      if (isEdge(it)) return;
      const orig = {}; for (const sid of STATE.sel) { const o = find(sid); if (o && !isEdge(o) && !o.locked) orig[sid] = { x: o.x, y: o.y }; }
      STATE.drag = { type: 'move', start: p, orig, pre: snap(), moved: false, clickId: id, multi: STATE.sel.size > 1 && !(e.shiftKey || e.metaKey || e.ctrlKey) };
      return;
    }
    if (e.pointerType === 'touch') { STATE.sel.clear(); changed(); STATE.drag = panDrag(e); return; }
    if (!e.shiftKey) { STATE.sel.clear(); changed(); }
    STATE.drag = { type: 'marquee', start: p, base: new Set(STATE.sel) };
  });
  STATE.svg.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (STATE.pinch) { doPinch(); return; } }
    if (STATE.pinch) return;
    if (STATE.drag && STATE.dragPid !== null && e.pointerId !== STATE.dragPid) return;
    const p = toWorld(e);
    if (STATE.lp && Math.hypot(e.clientX - STATE.lp.x, e.clientY - STATE.lp.y) > 9) clearLP();
    if (STATE.drag && STATE.drag.type === 'ink') {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of (evs.length ? evs : [e])) {
        const q = toWorld(ev), l = STATE.drag.pts[STATE.drag.pts.length - 1], dScr = Math.hypot(q.x - l[0], q.y - l[1]) * STATE.view.k;
        if (dScr <= 1.2) continue;
        const dt = Math.max(1, ev.timeStamp - STATE.drag.lt), v = dScr / dt; STATE.drag.lt = ev.timeStamp;
        let pr;
        if (ev.pointerType === 'pen' && ev.pressure > 0) pr = Math.max(.08, ev.pressure) * (1 - Math.min(.2, v * .04));
        else { const target = Math.min(1, Math.max(.28, 1.05 - v * .32)); pr = STATE.drag.pp = STATE.drag.pp * .72 + target * .28; }
        const sm = .45, nx = l[0] + (q.x - l[0]) * (1 - sm), ny = l[1] + (q.y - l[1]) * (1 - sm);
        STATE.drag.pts.push([nx, ny, pr]); STATE.drag.raw = [q.x, q.y, pr];
      }
      drawUI(); return;
    }
    if (STATE.drag && STATE.drag.type === 'lasso') { const l = STATE.drag.pts[STATE.drag.pts.length - 1]; if (Math.hypot(p.x - l[0], p.y - l[1]) * STATE.view.k > 3) STATE.drag.pts.push([p.x, p.y]); drawUI(); return; }
    if (STATE.drag && STATE.drag.type === 'erase') { eraseAt(e); return; }
    if (STATE.drag && STATE.drag.type === 'reconnect') {
      STATE.drag.cur = p; const e2 = find(STATE.drag.eid), fixed = e2 && (STATE.drag.end === 'from' ? e2.to : e2.from), t = nodeAt(p, 0, fixed), tid = t ? t.id : null;
      if (tid !== STATE.drag.target) { STATE.drag.target = tid; STATE.drag.targetT0 = now(); render(); } else drawUI();
      return;
    }
    if (!STATE.drag) {
      const n = (STATE.tool === 'select' || STATE.tool === 'conn') ? (nodeAt(p, 0) || (STATE.hoverId && nodeAt(p, 30 / STATE.view.k))) : null;
      const nid = n ? n.id : null; if (nid !== STATE.hoverId) { STATE.hoverId = nid; drawUI(); }
      return;
    }
    if (STATE.drag.type === 'pan') { STATE.view.x = STATE.drag.vx + e.clientX - STATE.drag.sx; STATE.view.y = STATE.drag.vy + e.clientY - STATE.drag.sy; applyView(); return; }
    if (STATE.drag.type === 'move') {
      let dx = p.x - STATE.drag.start.x, dy = p.y - STATE.drag.start.y;
      if (!STATE.drag.moved && Math.hypot(dx, dy) * STATE.view.k < 3) return;
      if (!STATE.drag.moved) STATE.drag.liftT0 = now();
      STATE.drag.moved = true;
      const sn = snapMove(dx, dy, e.altKey); dx = sn.dx; dy = sn.dy; STATE.drag.guides = sn.guides;
      for (const id in STATE.drag.orig) { const o = find(id); o.x = Math.round(STATE.drag.orig[id].x + dx); o.y = Math.round(STATE.drag.orig[id].y + dy); }
      if (physOn()) { for (const id in STATE.drag.orig) phys.fixed.add(id); physKick(); }
      render(); return;
    }
    if (STATE.drag.type === 'resize') {
      const it = find(STATE.drag.id), o = STATE.drag.o, dx = p.x - STATE.drag.start.x, dy = p.y - STATE.drag.start.y, hd = STATE.drag.h, minW = isText(it) ? 40 : isInk(it) ? 8 : 36, minH = isInk(it) ? 8 : 28;
      let { x, y, w, h } = o;
      if (hd.includes('e')) w = Math.max(minW, o.w + dx);
      if (hd.includes('w')) { w = Math.max(minW, o.w - dx); x = o.x + o.w - w; }
      if (!isText(it)) {
        if (hd.includes('s')) h = Math.max(minH, o.h + dy);
        if (hd.includes('n')) { h = Math.max(minH, o.h - dy); y = o.y + o.h - h; }
        if ((e.shiftKey !== isInk(it)) && hd.length === 2) { const s = Math.max(w / o.w, h / o.h); w = o.w * s; h = o.h * s; if (hd.includes('w')) x = o.x + o.w - w; if (hd.includes('n')) y = o.y + o.h - h; }
        it.h = Math.round(h); it.y = Math.round(y);
      }
      it.x = Math.round(x); it.w = Math.round(w); STATE.drag.moved = true; fitNode(it);
      if (physOn() && isNode(it)) { phys.fixed.add(it.id); physKick(); }
      render(); renderPanelNums(); return;
    }
    if (STATE.drag.type === 'marquee') {
      STATE.drag.cur = p; const m = rectOf(STATE.drag.start, p); STATE.sel = new Set(STATE.drag.base);
      for (const it of STATE.doc.items) { const b = bbox(it); if (b.x < m.x + m.w && b.x + b.w > m.x && b.y < m.y + m.h && b.y + b.h > m.y) STATE.sel.add(it.id); }
      expandGroups(STATE.sel); drawUI(); return;
    }
    if (STATE.drag.type === 'create') { STATE.drag.cur = p; drawUI(); return; }
    if (STATE.drag.type === 'connect') {
      STATE.drag.cur = p; const t = nodeAt(p, 0, STATE.drag.from), tid = t ? t.id : null;
      if (tid !== STATE.drag.target) { STATE.drag.target = tid; STATE.drag.targetT0 = now(); render(); } else drawUI();
    }
  });
  STATE.svg.addEventListener('pointerup', onUp);
  STATE.svg.addEventListener('pointercancel', onUp);
  STATE.svg.addEventListener('pointerleave', () => { if (!STATE.drag && STATE.hoverId) { STATE.hoverId = null; drawUI(); } });
  STATE.lastDown = null;
  STATE.lp = null;
  STATE.ctxAt = 0;
  $('#ctx').addEventListener('click', e => {
    const b = (e.target as HTMLInputElement).closest<HTMLInputElement>('[data-c]'); if (!b) return; const c = b.dataset.c; closeMenus();
    if (c === 'copy') { if (copy()) toast(MSG.copied); }
    if (c === 'cut') { if (copy()) del(); }
    if (c === 'paste') paste();
    if (c === 'dup') { if (copy()) paste(); }
    if (c === 'group') groupSel();
    if (c === 'ungroup') ungroupSel();
    if (c === 'brush') startBrush();
    if (c === 'pstyle') pasteStyle();
    if (c === 'edit') { const o = selObjs()[0]; if (o) openEditor(o.id); }
    if (c === 'top' || c === 'bottom') reorder(c);
    if (c === 'del') del();
    if (c === 'selall') { STATE.sel = new Set(STATE.doc.items.map(i => i.id)); changed(); }
    if (c === 'lasso') setTool('lasso');
    if (c === 'pen') setTool('pen');
  });
  STATE.svg.addEventListener('contextmenu', e => {
    e.preventDefault(); if (STATE.editing) closeEditor();
    const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest<HTMLInputElement>('[data-id]'), id = t && t.dataset.id;
    if (id && !STATE.sel.has(id)) { STATE.sel = expandGroups(new Set([id])); changed(); }
    else if (!id && STATE.sel.size) { STATE.sel.clear(); changed(); }
    showCtx(e.clientX, e.clientY);
  });
  STATE.viewAnim = 0;
  STATE.svg.addEventListener('wheel', e => {
    e.preventDefault(); cancelAnimationFrame(STATE.viewAnim);
    let dx = e.deltaX, dy = e.deltaY; if (e.deltaMode === 1) { dx *= 16; dy *= 16; } else if (e.deltaMode === 2) { dx *= 400; dy *= 400; }
    if (e.ctrlKey || e.metaKey) { zoomAt(e.clientX, e.clientY, Math.exp(-dy * .01)); return; }
    const mouse = e.deltaMode !== 0 || (dx === 0 && (((e as any).wheelDeltaY && Math.abs((e as any).wheelDeltaY) % 120 === 0) || Math.abs(dy) >= 100 && Number.isInteger(dy)));
    if (e.shiftKey) { STATE.view.x -= dx || dy; applyView(); return; }
    if (!mouse) { STATE.view.x -= dx; STATE.view.y -= dy; applyView(); return; }
    zoomAt(e.clientX, e.clientY, Math.exp(-dy * .0018));
  }, { passive: false });
  STATE.gest = null;
  STATE.svg.addEventListener('gesturestart', e => { e.preventDefault(); STATE.gest = { k: STATE.view.k }; });
  STATE.svg.addEventListener('gesturechange', (e: any) => { e.preventDefault(); if (!STATE.gest || touches.size >= 2) return; zoomAt(e.clientX, e.clientY, (STATE.gest.k * e.scale) / STATE.view.k); });
  STATE.svg.addEventListener('gestureend', e => { e.preventDefault(); STATE.gest = null; });
}
