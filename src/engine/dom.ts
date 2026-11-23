// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';

/** Query the editor shell. Returns `any` because the engine uses these as inputs, divs and SVG alike. */
export const $ = (s: string): any => document.querySelector(s);
export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const now = () => performance.now();
export const anims = new Map();
export function anim(id, name, dur) { if (!RM) anims.set(id, { name, t0: now(), dur }); }
export function animOf(id) {
  if (STATE.drag && STATE.drag.type === 'move' && STATE.drag.moved && STATE.drag.orig[id]) return { name: 'lift', t0: STATE.drag.liftT0 };
  if (STATE.drag && (STATE.drag.type === 'connect' || STATE.drag.type === 'reconnect') && STATE.drag.target === id) return { name: 'magnet', t0: STATE.drag.targetT0 };
  const a = anims.get(id); if (!a) return null;
  if (now() - a.t0 > a.dur) { anims.delete(id); return null; } return a;
}
export const animAttr = (a, extra = '') => a ? ` class="an an-${a.name}${extra}" style="animation-delay:-${Math.round(now() - a.t0)}ms"` : (extra ? ` class="${extra.trim()}"` : '');

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initDom() {
  STATE.app = $('#app');
  STATE.svg = $('#cv');
  STATE.world = $('#world');
  STATE.gE = $('#edges');
  STATE.gN = $('#nodes');
  STATE.gT = $('#texts');
  STATE.gUI = $('#ui');
  STATE.gG = $('#ghosts');
  STATE.gK = $('#inks');
  STATE.ghosts = [];
  STATE.prevSel = new Set();
  STATE.edwrap = $('#edwrap');
  STATE.ed = $('#ed');
  STATE.panel = $('#panel');
}
