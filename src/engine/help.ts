// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { $ } from './dom';
import { shortcutList } from './strings';

// ---------- shortcut help ----------
export const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export function toggleHelp(show?) { const h = $('#help'); h.classList.toggle('show', show === undefined ? !h.classList.contains('show') : show); }
export function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('show'); clearTimeout(STATE.toastT); STATE.toastT = setTimeout(() => t.classList.remove('show'), 1800); }

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initHelp() {
  STATE.MK = isMac ? '⌘' : 'Ctrl';
  STATE.KEYS = shortcutList(STATE.MK, isMac);
  $('#kgrid').innerHTML = STATE.KEYS.map(([a, b]) => `<div><span>${a}</span><kbd>${b}</kbd></div>`).join('');
  $('#keys').onclick = () => toggleHelp(true);
  $('#helpX').onclick = () => toggleHelp(false);
  $('#help').addEventListener('click', e => { if ((e.target as HTMLInputElement).id === 'help') toggleHelp(false); });
  STATE.toastT = 0;
}
