// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { $ } from './dom';
import { toast } from './help';
import { syncRanges, tgl } from './panel';
import { draw } from './render';
import { isNode, isText, snap } from './state-init';
import { changed, commit, scheduleSave } from './storage';
import { bbox } from './text';
import { MSG } from './strings';

// ---------- physics ----------
export const phys = { raf: 0, pre: null, fixed: new Set(), frames: 0 };
export const physOn = () => !!(STATE.doc.phys && STATE.doc.phys.on);
export function physStep() {
  const P = STATE.doc.phys, gap = +P.gap, kk = .08 + .4 * P.strength / 100;
  const bodies: { o: { x: number; y: number; w: number; h: number }; fixed: boolean }[] = STATE.doc.items.filter(isNode).map(n => ({ o: n, fixed: n.locked || phys.fixed.has(n.id) }));
  for (const t of STATE.doc.items) if (isText(t) && t.avoid) bodies.push({ o: bbox(t), fixed: true });
  const disp = new Map(); let moved = 0;
  const add = (b, x, y) => { const d = disp.get(b) || { x: 0, y: 0 }; d.x += x; d.y += y; disp.set(b, d); };
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const A = bodies[i], B = bodies[j]; if (A.fixed && B.fixed) continue;
    const a = A.o, b = B.o, dx = (b.x + b.w / 2) - (a.x + a.w / 2), dy = (b.y + b.h / 2) - (a.y + a.h / 2);
    const ox = (a.w + b.w) / 2 + gap - Math.abs(dx), oy = (a.h + b.h) / 2 + gap - Math.abs(dy);
    if (ox <= 0 || oy <= 0) continue;
    let vx = 0, vy = 0;
    if (ox < oy) vx = (dx >= 0 ? 1 : -1) * ox; else vy = (dy >= 0 ? 1 : -1) * oy;
    if (A.fixed) add(B, vx, vy); else if (B.fixed) add(A, -vx, -vy); else { add(A, -vx / 2, -vy / 2); add(B, vx / 2, vy / 2); }
  }
  for (const [b, d] of disp) { const mx = d.x * kk, my = d.y * kk; b.o.x += mx; b.o.y += my; moved += Math.abs(mx) + Math.abs(my); }
  return moved;
}
export function physLoop() {
  phys.raf = 0;
  const m = physStep(); draw();
  const live = STATE.drag && (STATE.drag.type === 'move' || STATE.drag.type === 'resize');
  if (live || (m > .25 && ++phys.frames < 600)) phys.raf = requestAnimationFrame(physLoop);
  else physDone();
}
export function physKick() { if (physOn() && !phys.raf) phys.raf = requestAnimationFrame(physLoop); }
export function physDone() {
  for (const n of STATE.doc.items) if (isNode(n)) { n.x = Math.round(n.x); n.y = Math.round(n.y); }
  phys.fixed.clear(); phys.frames = 0;
  if (phys.pre) { const pre = phys.pre; phys.pre = null; if (pre !== snap()) commit(pre); else changed(); }
  else changed();
}
export function physAfter(ids, pre?) { if (!physOn()) return; phys.pre = phys.pre || pre || snap(); for (const id of ids) phys.fixed.add(id); phys.frames = 0; physKick(); }
export function physStop() { cancelAnimationFrame(phys.raf); phys.raf = 0; phys.pre = null; phys.fixed.clear(); phys.frames = 0; }
export function togglePhys() {
  STATE.doc.phys.on = !STATE.doc.phys.on; renderPhys(); scheduleSave();
  if (STATE.doc.phys.on) { physAfter([]); toast(MSG.elasticModeOnOverlappingNodes); }
  else { if (phys.raf) { cancelAnimationFrame(phys.raf); phys.raf = 0; physDone(); } toast(MSG.freeModeNodesCanOverlap); }
}
export function renderPhys() {
  const P = STATE.doc.phys;
  $('#bPhys').classList.toggle('on', P.on);
  $('#pPhys').innerHTML = `<h4>Physics</h4>${tgl('phys', P.on, 'Elastic mode')}
  <p class="note">${P.on ? 'Nodes that get too close or overlap glide apart. The node you drag follows the pointer; locked nodes never move.' : 'Free mode: nodes can overlap freely and nothing else moves.'}</p>
  <div class="row" style="margin:14px 0 10px"><div class="lab">Strength<span id="pvS">${P.strength}</span></div><input type="range" min="0" max="100" data-p="strength" value="${P.strength}"></div>
  <div class="row" style="margin:0"><div class="lab">Spacing<span id="pvG">${P.gap} px</span></div><input type="range" min="0" max="60" data-p="gap" value="${P.gap}"></div>`;
  syncRanges($('#pPhys'));
}

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initPhysics() {
  $('#pPhys').addEventListener('click', e => { if ((e.target as HTMLInputElement).closest<HTMLInputElement>('[data-act=phys]')) togglePhys(); });
  $('#pPhys').addEventListener('input', e => {
    const k2 = (e.target as HTMLInputElement).dataset.p; if (!k2) return;
    STATE.doc.phys[k2] = +(e.target as HTMLInputElement).value;
    $('#pvS').textContent = STATE.doc.phys.strength; $('#pvG').textContent = STATE.doc.phys.gap + ' px';
    scheduleSave(); if (k2 === 'gap') physAfter([]);
  });
}
