// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { closeMenus, zoomBtn } from './chrome';
import { $ } from './dom';
import { openEditor } from './editing';
import { toast, toggleHelp } from './help';
import { applyAll, renderPanel } from './panel';
import { togglePhys } from './physics';
import { clearLP, fitView, setTool } from './pointer';
import { addSibling, flowSide, quickAdd, stepFs } from './quick-extend';
import { arrange, copy, copyStyle, del, groupSel, mutate, paste, pasteStyle, selObjs, stopBrush, ungroupSel } from './selection';
import { isNode } from './state-init';
import { changed, newCanvas, redo, undo } from './storage';
import { MSG } from './strings';
import { COLLAB } from './space';

// ---------- keyboard ----------
export const typing = () => STATE.editing || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement && document.activeElement.tagName);

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initKeyboard() {
  window.addEventListener('keydown', e => {
    if (typing()) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (COLLAB.readOnly && !(e.code === 'Space' || k === 'escape' || k === '?' || (mod && ['0', '=', '-', '+', 'c', 'a'].includes(k)))) return;
    if (e.code === 'Space') { if (!STATE.spaceDown) { STATE.spaceDown = true; STATE.app.classList.add('panning'); } e.preventDefault(); return; }
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.shiftKey && (e.code === 'Period' || e.code === 'Comma')) { e.preventDefault(); stepFs(e.code === 'Period' ? 1 : -1); return; }
    if (mod && k === 'enter') { e.preventDefault(); const o = selObjs(); if (o.length === 1 && isNode(o[0])) addSibling(o[0]); return; }
    if (mod && k === 'a') { e.preventDefault(); STATE.sel = new Set(STATE.doc.items.map(i => i.id)); changed(); return; }
    if (mod && e.altKey && e.code === 'KeyC') { e.preventDefault(); if (copyStyle()) { toast(MSG.styleCopied); renderPanel(); } return; }
    if (mod && e.altKey && e.code === 'KeyV') { e.preventDefault(); pasteStyle(); return; }
    if (mod && e.code === 'KeyG') { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); return; }
    if (mod && k === 'c') { if (copy()) toast(MSG.copied); return; }
    if (mod && k === 'x') { STATE.cutDone = false; setTimeout(() => { if (!STATE.cutDone && copy()) del(); }, 80); return; }
    if (mod && k === 'v') { STATE.pasteDone = false; setTimeout(() => { if (!STATE.pasteDone) paste(); }, 80); return; }
    if (mod && k === 'd') { e.preventDefault(); if (copy()) paste(); return; }
    if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomBtn(1.2); return; }
    if (mod && k === '-') { e.preventDefault(); zoomBtn(1 / 1.2); return; }
    if (mod && k === '0') { e.preventDefault(); fitView(true); return; }
    if (mod) return;
    if (e.altKey && e.code === 'KeyN') { e.preventDefault(); newCanvas(); return; }
    if (e.altKey) { const am = e.shiftKey ? { KeyH: 'dh', KeyV: 'dv' } : { KeyA: 'l', KeyH: 'ch', KeyD: 'r', KeyW: 't', KeyV: 'cv', KeyS: 'b' }; if (am[e.code] && STATE.sel.size) { e.preventDefault(); arrange(am[e.code]); } return; }
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); del(); return; }
    if (k === 'escape' && $('#help').classList.contains('show')) { toggleHelp(false); return; }
    if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) { e.preventDefault(); toggleHelp(); return; }
    if (k === 'p') { togglePhys(); return; }
    if (k === 'escape' && STATE.painter) { stopBrush(); toast(MSG.formatPainterCancelled); return; }
    if (k === 'escape') { clearLP(); STATE.sel.clear(); closeMenus(); setTool('select'); changed(); return; }
    if (k === 'enter' && STATE.sel.size === 1) { const o = selObjs()[0]; if (o) { e.preventDefault(); openEditor(o.id); } return; }
    if (k === 'tab') { e.preventDefault(); const o = selObjs(); if (o.length === 1 && isNode(o[0])) quickAdd(o[0], flowSide(o[0]), o[0]); return; }
    if (k.startsWith('arrow') && STATE.sel.size) {
      e.preventDefault(); const s = e.shiftKey ? 10 : 1, dx = k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, dy = k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0;
      mutate(() => applyAll(o => { if (!o.locked) { o.x += dx; o.y += dy; } })); return;
    }
    const map = { v: 'select', h: 'hand', 1: 'rect', 2: 'roundrect', 3: 'circle', 4: 'diamond', 5: 'capsule', r: 'rect', o: 'circle', l: 'conn', t: 'text', b: 'pen', q: 'lasso' };
    if (map[k]) setTool(map[k]);
  });
  window.addEventListener('keyup', e => { if (e.code === 'Space') { if (!typing()) e.preventDefault(); STATE.spaceDown = false; STATE.app.classList.remove('panning'); } });
  window.addEventListener('blur', () => { STATE.spaceDown = false; STATE.app.classList.remove('panning'); });
}
