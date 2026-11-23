import { COLLAB } from './space';
// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { FONT, LBL_FS, LH } from './constants';
import { anims } from './dom';
import { renderPanel } from './panel';
import { flowSide, quickAdd, stepFs } from './quick-extend';
import { render } from './render';
import { edgeGeomOf } from './routing';
import { find, isEdge, isInk, isNode, isText, snap } from './state-init';
import { changed, commit } from './storage';
import { TPX, TPY, defFs, fitNode, innerBox } from './text';
import { tc } from './theme';

// ---------- editing ----------
export function openEditor(id, pre?) {
  const it = find(id); if (!it || isInk(it) || COLLAB.readOnly) return;
  closeEditor(); STATE.editing = id; STATE.sel = new Set([id]); if (anims.has(id)) STATE.prevSel.add(id);
  const E = isEdge(it);
  STATE.editing_pre = pre || snap(); STATE.editing_orig = E ? (it.label || '') : it.text; STATE.editing_new = !!pre;
  STATE.ed.textContent = STATE.editing_orig;
  Object.assign(STATE.ed.style, { fontSize: (E ? LBL_FS : defFs(it)) + 'px', color: E ? STATE.C.ink : tc(it), fontWeight: !E && it.bold ? 700 : 400, textAlign: E ? 'center' : it.align, fontFamily: FONT, width: '100%' });
  STATE.edwrap.classList.toggle('lbl', E);
  STATE.edwrap.style.display = 'flex';
  placeEditor(); render(); renderPanel();
  setTimeout(() => {
    if (STATE.editing !== id) return; STATE.ed.focus();
    const r = document.createRange(); r.selectNodeContents(STATE.ed); if (pre) r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }, 0);
}
export function placeEditor() {
  const it = find(STATE.editing); if (!it) return;
  let b;
  if (isEdge(it)) { const g = edgeGeomOf(it); if (!g) return; b = { x: g.mid.x - 88, y: g.mid.y - LBL_FS * LH / 2 - 4, w: 176 }; STATE.edwrap.style.height = 'auto'; STATE.edwrap.style.justifyContent = 'center'; }
  else if (isText(it)) { b = { x: it.x + TPX, y: it.y + TPY, w: it.w - 2 * TPX }; STATE.edwrap.style.height = 'auto'; STATE.edwrap.style.justifyContent = 'flex-start'; }
  else { b = innerBox(it); STATE.edwrap.style.height = b.h + 'px'; STATE.edwrap.style.justifyContent = it.valign === 'top' ? 'flex-start' : it.valign === 'bottom' ? 'flex-end' : 'center'; }
  STATE.edwrap.style.width = b.w + 'px';
  const r = STATE.svg.getBoundingClientRect();
  STATE.edwrap.style.transform = `translate(${r.left + STATE.view.x + b.x * STATE.view.k}px,${r.top + STATE.view.y + b.y * STATE.view.k}px) scale(${STATE.view.k})`;
}
export function readEd() { return STATE.ed.innerText.replace(/\n$/, ''); }
export function closeEditor() {
  if (!STATE.editing) return;
  const it = find(STATE.editing), id = STATE.editing; STATE.editing = null; STATE.edwrap.style.display = 'none'; STATE.edwrap.classList.remove('lbl');
  if (it && isEdge(it)) {
    const v = readEd().trim(); if (v) it.label = v; else delete it.label;
    if ((it.label || '') !== STATE.editing_orig) commit(STATE.editing_pre); else changed();
  } else if (it) {
    it.text = readEd(); fitNode(it);
    if (isText(it) && !it.text.trim()) { STATE.doc.items = STATE.doc.items.filter(i => i !== it); STATE.sel.delete(id); if (!STATE.editing_new) commit(STATE.editing_pre); else changed(); }
    else if (it.text !== STATE.editing_orig || STATE.editing_new) commit(STATE.editing_pre);
    else changed();
  }
  STATE.ed.blur();
}

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initEditing() {
  STATE.editing_pre = null;
  STATE.editing_orig = '';
  STATE.editing_new = false;
  STATE.ed.addEventListener('input', () => { const it = find(STATE.editing); if (!it) return; if (isEdge(it)) it.label = readEd(); else { it.text = readEd(); fitNode(it); } render(); });
  STATE.ed.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); closeEditor(); return; }
    if (e.key === 'Tab') { e.preventDefault(); const it = find(STATE.editing); if (isNode(it)) { closeEditor(); quickAdd(it, flowSide(it), it); } else closeEditor(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'Period' || e.code === 'Comma')) { e.preventDefault(); const it = find(STATE.editing); if (it && !isEdge(it)) { stepFs(e.code === 'Period' ? 1 : -1); STATE.ed.style.fontSize = defFs(it) + 'px'; placeEditor(); } }
  });
  try { STATE.ed.contentEditable = 'plaintext-only'; } catch (e: any) { }
  if (STATE.ed.contentEditable !== 'plaintext-only') STATE.ed.contentEditable = 'true';
  STATE.ed.addEventListener('paste', e => { if (STATE.ed.contentEditable === 'true') { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); } });
}
