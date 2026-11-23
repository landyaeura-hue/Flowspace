// Canvas engine entry: attaches to the DOM rendered by <Shell/>.
import { STATE } from './state';
import { initDom } from './dom';
import { initTheme } from './theme';
import { initStateInit } from './state-init';
import { initText } from './text';
import { initRender } from './render';
import { initStorage } from './storage';
import { initEditing } from './editing';
import { initPointer } from './pointer';
import { initPhysics } from './physics';
import { initLayout } from './layout';
import { initPanel } from './panel';
import { initKeyboard } from './keyboard';
import { initChrome } from './chrome';
import { initClipboard } from './clipboard';
import { initHelp } from './help';
import { initExport } from './export';
import { setTool } from './pointer';
import { load, saveNow } from './storage';
import { drawUI } from './render';
import { placeEditor } from './editing';

let mounted = false;

/** Safe to call twice (React StrictMode). */
export function mountEngine(): void {
  if (mounted) return;
  mounted = true;
  initDom();
  initTheme();
  initStateInit();
  initText();
  initRender();
  initStorage();
  initEditing();
  initPointer();
  initPhysics();
  initLayout();
  initPanel();
  initKeyboard();
  initChrome();
  initClipboard();
  initHelp();
  initExport();
  // ---------- boot ----------
setTool('select');
  load();
  window.addEventListener('pagehide', () => { if (STATE.curId) saveNow(); });
  window.addEventListener('resize', () => { drawUI(); if (STATE.editing) placeEditor(); });
}
