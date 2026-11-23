// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { $, now } from './dom';
import { renderPanel } from './panel';
import { renderPhys, togglePhys } from './physics';
import { fitView, setTool, zoomTo } from './pointer';
import { draw } from './render';
import { find, isEdge, savePrefs } from './state-init';
import { deleteCanvas, dupCanvas, newCanvas, openCanvas, redo, renderFiles, saveNow, scheduleSave, undo } from './storage';
import { applyTheme, renderThemes } from './theme';

export function zoomBtn(f) { zoomTo(STATE.view.k * f); }
export function setBg(b) {
  const changedBg = STATE.doc.bg !== b; STATE.doc.bg = b; STATE.app.classList.toggle('bg-blue', b === 'blue'); STATE.app.classList.toggle('bg-white', b === 'white'); STATE.app.classList.toggle('bg-dark', b === 'dark');
  applyTheme(); if (changedBg && STATE.doc.items) { draw(); renderPanel(); renderThemes(); } document.querySelectorAll<HTMLInputElement>('[data-bg]').forEach(x => x.classList.toggle('on', x.dataset.bg === b)); scheduleSave();
}
export function closeMenus() { document.querySelectorAll<HTMLInputElement>('.menu,.pop').forEach(m => m.classList.remove('show')); }
export function renderXopts() {
  const has = [...STATE.sel].some(id => { const o = find(id); return o && !isEdge(o); });
  document.querySelectorAll<HTMLInputElement>('[data-xo]').forEach(t => { const k2 = t.dataset.xo; t.classList.toggle('on', !!STATE.xopts[k2] && (k2 !== 'sel' || has)); t.classList.toggle('dis', k2 === 'sel' && !has); t.title = k2 === 'sel' && !has ? 'Select something on the canvas first' : ''; });
}

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initChrome() {
  // ---------- chrome ----------
  document.querySelectorAll<HTMLInputElement>('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('#undo').onclick = undo;
  $('#redo').onclick = redo;
  $('#zIn').onclick = () => zoomBtn(1.2);
  $('#zOut').onclick = () => zoomBtn(1 / 1.2);
  $('#zoomv').onclick = () => zoomTo(1);
  $('#fit').onclick = () => fitView(true);
  document.querySelectorAll<HTMLInputElement>('[data-bg]').forEach(b => b.onclick = () => setBg(b.dataset.bg));
  $('#fname').addEventListener('change', e => { STATE.doc.name = (e.target as HTMLInputElement).value.trim() || 'Untitled canvas'; (e.target as HTMLInputElement).value = STATE.doc.name; document.title = STATE.doc.name + ' · FlowSpace'; saveNow(); scheduleSave(); });
  $('#fname').addEventListener('keydown', e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); });
  $('#bExport').onclick = e => { e.stopPropagation(); const m = $('#mExport'), o = m.classList.contains('show'); closeMenus(); if (!o) { renderXopts(); m.classList.add('show'); } };
  $('#mExport').addEventListener('click', e => { const t = (e.target as HTMLInputElement).closest<HTMLInputElement>('[data-xo]'); if (!t) return; e.stopPropagation(); STATE.xopts[t.dataset.xo] = !STATE.xopts[t.dataset.xo]; savePrefs(); renderXopts(); });
  $('#bShare').onclick = e => { e.stopPropagation(); const m = $('#mShare'), o = m.classList.contains('show'); closeMenus(); if (!o) m.classList.add('show'); };
  document.addEventListener('click', e => { if (now() - STATE.ctxAt < 450 || (e.target as HTMLInputElement).closest<HTMLInputElement>('#cv')) return; if (!document.contains(e.target as Node) || (e.target as HTMLInputElement).closest<HTMLInputElement>('.menu,.pop,#bPhysSet,#bLayout,#bTheme')) return; closeMenus(); });
  $('#bPhys').onclick = e => { e.stopPropagation(); togglePhys(); };
  $('#bPhysSet').onclick = e => { e.stopPropagation(); const m = $('#pPhys'), o = m.classList.contains('show'); closeMenus(); if (!o) { renderPhys(); m.classList.add('show'); } };
  $('#bTheme').onclick = e => { e.stopPropagation(); const m = $('#pTheme'), o = m.classList.contains('show'); closeMenus(); if (!o) { renderThemes(); m.classList.add('show'); } };
  $('#bFiles').onclick = e => { e.stopPropagation(); const m = $('#mFiles'), o = m.classList.contains('show'); closeMenus(); if (!o) { STATE.pendingDel = null; renderFiles(); m.classList.add('show'); } };
  $('#mFiles').addEventListener('click', e => {
    const t = (e.target as HTMLInputElement).closest<HTMLInputElement>('[data-f],[data-open],[data-dup],[data-delc],[data-delyes],[data-delno]'); if (!t) return;
    e.stopPropagation();
    if (t.dataset.f === 'new') return newCanvas();
    if (t.dataset.dup) { closeMenus(); return dupCanvas(t.dataset.dup); }
    if (t.dataset.delc) { STATE.pendingDel = t.dataset.delc; return renderFiles(); }
    if (t.dataset.delno) { STATE.pendingDel = null; return renderFiles(); }
    if (t.dataset.delyes) return deleteCanvas(t.dataset.delyes);
    if (t.dataset.open) { closeMenus(); if (t.dataset.open !== STATE.curId) openCanvas(t.dataset.open); }
  });
  $('#bLayout').onclick = e => { e.stopPropagation(); const m = $('#mLayout'), o = m.classList.contains('show'); closeMenus(); if (!o) m.classList.add('show'); };
}
