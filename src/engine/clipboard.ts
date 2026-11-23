import { COLLAB } from './space';
// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { typing } from './keyboard';
import { copy, del, paste, pasteText, selObjs } from './selection';
import { esc, isEdge } from './state-init';

export const selPlain = () => selObjs().filter(o => !isEdge(o) && o.text).map(o => o.text).join('\n');
export function writeClip(e) { const p2 = selPlain(); e.clipboardData.setData('text/plain', p2 || ' '); e.clipboardData.setData('text/html', `<!--flowspace:${encodeURIComponent(STATE.clip)}-->` + esc(p2)); }

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initClipboard() {
  STATE.cutDone = true;
  STATE.pasteDone = true;
  document.addEventListener('copy', e => { if (typing() || !copy()) return; e.preventDefault(); writeClip(e); });
  document.addEventListener('cut', e => { if (typing() || COLLAB.readOnly) return; STATE.cutDone = true; if (!copy()) return; e.preventDefault(); writeClip(e); del(); });
  document.addEventListener('paste', e => {
    if (typing() || COLLAB.readOnly) return; STATE.pasteDone = true; e.preventDefault();
    const html = e.clipboardData.getData('text/html') || '', mt = html.match(/<!--flowspace:([^>]*?)-->/);
    if (mt) { try { const j = decodeURIComponent(mt[1]); if (j !== STATE.clip) { STATE.clip = j; STATE.pasteN = 0; } } catch (er: any) { } paste(); return; }
    const t = e.clipboardData.getData('text/plain');
    if (t && t.trim()) pasteText(t.trim()); else paste();
  });
}
