// Other people's cursors and selections, drawn as an HTML layer over the canvas.
import { useCloud } from '../cloud/store';
import { STATE } from '../engine/state';
import { find } from '../engine/state-init';
import { bbox } from '../engine/text';

interface Peer { x: number | null; y: number | null; sel: string[]; ed: string | null; t: number; el: HTMLDivElement; boxes: HTMLDivElement[] }
const peers = new Map<string, Peer>();
let layer: HTMLDivElement | null = null, raf = 0, myUid: () => string = () => '';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export const knownPeers = () => [...peers.keys()];

export function peerCursor(uid: string, m: { x: number | null; y: number | null; sel?: string[]; ed?: string | null }) {
  if (!layer || uid === myUid()) return;
  let p = peers.get(uid);
  if (!p) {
    const el = document.createElement('div'); el.className = 'pc';
    el.innerHTML = '<svg viewBox="0 0 20 20"><path d="M3 2l13 7.2-5.6 1.5L8 16z"/></svg><span></span>';
    layer.appendChild(el); p = { x: null, y: null, sel: [], ed: null, t: 0, el, boxes: [] }; peers.set(uid, p);
  }
  p.x = m.x; p.y = m.y; p.sel = Array.isArray(m.sel) ? m.sel : []; p.ed = m.ed || null; p.t = Date.now();
  if (!raf) raf = requestAnimationFrame(frame);
}
export function peerGone(uid: string) {
  const p = peers.get(uid); if (!p) return;
  p.el.remove(); p.boxes.forEach(b => b.remove()); peers.delete(uid);
}

function frame() {
  raf = 0; if (!layer) return;
  const v = STATE.view, info = new Map(useCloud.getState().peers.map(p => [p.uid, p])), now = Date.now();
  for (const [uid, p] of peers) {
    const who = info.get(uid), color = who ? who.color : '#7183A3', name = who ? who.email.split('@')[0] : '';
    const idle = now - p.t > 12000;
    p.el.style.setProperty('--c', color);
    const label = p.el.querySelector('span') as HTMLSpanElement;
    if (label.dataset.n !== name) { label.dataset.n = name; label.innerHTML = esc(name); }
    if (p.x == null || p.y == null || idle) p.el.style.opacity = '0';
    else { p.el.style.opacity = '1'; p.el.style.transform = `translate(${p.x * v.k + v.x}px,${p.y * v.k + v.y}px)`; }
    const ids = p.ed ? [p.ed] : p.sel, rects: { x: number; y: number; w: number; h: number }[] = [];
    for (const id of ids) { const o = find(id); if (o && o.type) { const b = bbox(o); rects.push(b); } }
    while (p.boxes.length < rects.length) { const b = document.createElement('div'); b.className = 'ps'; layer.appendChild(b); p.boxes.push(b); }
    p.boxes.forEach((b, i) => {
      const r = rects[i];
      if (!r) { b.style.display = 'none'; return; }
      const pad = 5;
      b.style.display = 'block'; b.style.borderColor = color; b.classList.toggle('ed', !!p.ed);
      b.style.transform = `translate(${r.x * v.k + v.x - pad}px,${r.y * v.k + v.y - pad}px)`;
      b.style.width = r.w * v.k + pad * 2 + 'px'; b.style.height = r.h * v.k + pad * 2 + 'px';
      b.dataset.who = i === 0 ? (p.ed ? name + ' is editing' : name) : '';
      b.style.setProperty('--c', color);
    });
  }
  if (peers.size) raf = requestAnimationFrame(frame);
}

export function cursorsStart(me: () => string) {
  myUid = me;
  if (!layer) { layer = document.createElement('div'); layer.id = 'peers'; STATE.svg.after(layer); }
}
export function cursorsStop() {
  for (const uid of [...peers.keys()]) peerGone(uid);
  cancelAnimationFrame(raf); raf = 0;
}
