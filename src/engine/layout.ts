// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { closeMenus } from './chrome';
import { RM, now } from './dom';
import { closeEditor } from './editing';
import { toast } from './help';
import { physAfter, physStop } from './physics';
import { fitView } from './pointer';
import { draw } from './render';
import { selObjs } from './selection';
import { isNode, snap } from './state-init';
import { commit } from './storage';
import { MSG } from './strings';

export function autoLayout(dir) {
  closeMenus(); if (STATE.editing) closeEditor(); if (STATE.layoutBusy) return;
  let nodes = selObjs().filter(isNode); if (nodes.length < 2) nodes = STATE.doc.items.filter(isNode);
  const whole = nodes.length === STATE.doc.items.filter(isNode).length;
  nodes = nodes.filter(n => !n.locked);
  if (nodes.length < 2) { toast(MSG.needAtLeastTwoMovable); return; }
  const LR = dir === 'LR', ids = new Set(nodes.map(n => n.id)), byId = new Map(nodes.map(n => [n.id, n]));
  const E = STATE.doc.edges.filter(e => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  const linked = new Set(); E.forEach(e => { linked.add(e.from); linked.add(e.to); });
  const main = n => LR ? n.w : n.h, cross = n => LR ? n.h : n.w, pM = n => LR ? n.x : n.y, pC = n => LR ? n.y : n.x;
  const G = nodes.filter(n => linked.has(n.id)), iso = nodes.filter(n => !linked.has(n.id));
  // 1. break cycles (DFS, drop back edges)
  const adj = new Map(G.map(n => [n.id, []])), indeg0 = new Map(G.map(n => [n.id, 0]));
  E.forEach(e => { adj.get(e.from).push(e); indeg0.set(e.to, indeg0.get(e.to) + 1); });
  const st = new Map(), keep = [];
  const dfs = u => { st.set(u, 1); for (const e of adj.get(u)) { const s2 = st.get(e.to); if (s2 === 1) continue; keep.push(e); if (!s2) dfs(e.to); } st.set(u, 2); };
  [...G].sort((a, b) => (indeg0.get(a.id) - indeg0.get(b.id)) || (pM(a) - pM(b)) || (pC(a) - pC(b))).forEach(n => { if (!st.get(n.id)) dfs(n.id); });
  // 2. layers by longest path
  const preds = new Map(G.map(n => [n.id, []])), succs = new Map(G.map(n => [n.id, []]));
  keep.forEach(e => { preds.get(e.to).push(e.from); succs.get(e.from).push(e.to); });
  const layer = new Map(), indeg = new Map(G.map(n => [n.id, preds.get(n.id).length]));
  const q = G.filter(n => !indeg.get(n.id)).map(n => n.id); q.forEach(id => layer.set(id, 0));
  while (q.length) { const u = q.shift(); for (const v of succs.get(u)) { layer.set(v, Math.max(layer.get(v) || 0, layer.get(u) + 1)); indeg.set(v, indeg.get(v) - 1); if (!indeg.get(v)) q.push(v); } }
  const L = []; G.forEach(n => { const l = layer.get(n.id) || 0; (L[l] = L[l] || []).push(n.id); });
  for (let i = 0; i < L.length; i++) L[i] = L[i] || [];
  // 3. order within layers (barycenter sweeps)
  L.forEach(a => a.sort((x, y) => pC(byId.get(x)) - pC(byId.get(y))));
  const m = new Map(); L.forEach(a => a.forEach((id, i) => m.set(id, i)));
  for (let it = 0; it < 8; it++) {
    const down = it % 2 === 0, seq = down ? L.slice(1) : L.slice(0, -1).reverse();
    for (const a of seq) {
      const key = new Map(a.map(id => { const nb = down ? preds.get(id) : succs.get(id); return [id, nb.length ? nb.reduce((s2, x) => s2 + m.get(x), 0) / nb.length : m.get(id)]; }));
      a.sort((x, y) => (key.get(x) as number) - (key.get(y) as number)); a.forEach((id, i) => m.set(id, i));
    }
  }
  // 4. coordinates
  const GM = LR ? 110 : 90, GC = 48, P = new Map(); let mpos = 0;
  for (const a of L) {
    if (!a.length) continue;
    const lm = Math.max(...a.map(id => main(byId.get(id))));
    const want = a.map(id => { const pr = preds.get(id).filter(x => P.has(x)); return pr.length ? pr.reduce((s2, x) => s2 + P.get(x).c + cross(byId.get(x)) / 2, 0) / pr.length - cross(byId.get(id)) / 2 : null; });
    let c = 0; const pack = a.map(id => { const v = c; c += cross(byId.get(id)) + GC; return v; });
    const tot = c - GC; pack.forEach((v, i) => pack[i] = v - tot / 2);
    const des = a.map((id, i) => want[i] ?? pack[i]);
    for (let i = 1; i < des.length; i++) des[i] = Math.max(des[i], des[i - 1] + cross(byId.get(a[i - 1])) + GC);
    const shift = a.reduce((s2, id, i) => s2 + ((want[i] ?? des[i]) - des[i]), 0) / a.length;
    a.forEach((id, i) => P.set(id, { m: mpos + (lm - main(byId.get(id))) / 2, c: des[i] + shift }));
    mpos += lm + GM;
  }
  let cmax = 0; for (const [id, p2] of P) cmax = Math.max(cmax, p2.c + cross(byId.get(id)));
  let mm = 0; const c0 = P.size ? cmax + 80 : 0;
  iso.sort((a, b) => (pM(a) - pM(b)) || (pC(a) - pC(b))).forEach(n => { P.set(n.id, { m: mm, c: c0 }); mm += main(n) + 40; });
  const target = new Map(); let minX = Infinity, minY = Infinity;
  for (const [id, p2] of P) { const x = LR ? p2.m : p2.c, y = LR ? p2.c : p2.m; target.set(id, { x, y }); minX = Math.min(minX, x); minY = Math.min(minY, y); }
  const ox = Math.min(...nodes.map(n => n.x)), oy = Math.min(...nodes.map(n => n.y));
  for (const t of target.values()) { t.x = Math.round(t.x - minX + ox); t.y = Math.round(t.y - minY + oy); }
  // 5. animate, then one undo step
  physStop();
  const pre = snap(), from = new Map(nodes.map(n => [n.id, { x: n.x, y: n.y }])), t0 = now(), dur = RM ? 0 : 560;
  STATE.layoutBusy = true;
  const step = () => {
    const t = dur ? Math.min(1, (now() - t0) / dur) : 1, e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    for (const [id, f] of from) { const n = byId.get(id), to = target.get(id); n.x = f.x + (to.x - f.x) * e; n.y = f.y + (to.y - f.y) * e; }
    draw();
    if (t < 1) { requestAnimationFrame(step); return; }
    for (const n of nodes) { n.x = Math.round(n.x); n.y = Math.round(n.y); }
    STATE.layoutBusy = false; commit(pre); physAfter([...ids]);
    if (whole) fitView(true);
    toast(`Arranged ${nodes.length} nodes ${LR ? 'left to right' : 'top to bottom'} · undo to revert`);
  };
  requestAnimationFrame(step);
}

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initLayout() {
  STATE.layoutBusy = false;
  document.querySelectorAll<HTMLInputElement>('[data-lay]').forEach(b => b.addEventListener('click', () => autoLayout(b.dataset.lay)));
}
