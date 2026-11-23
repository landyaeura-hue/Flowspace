// A live session on the open cloud canvas: the engine's document mirrored into Yjs,
// changes exchanged over a realtime room, own-only undo, presence and cursors.
import * as Y from 'yjs';
import type { CloudBackend, PeerInfo, Role, Room } from '../cloud/backend';
import { setCloud } from '../cloud/store';
import { STATE } from '../engine/state';
import { $ } from '../engine/dom';
import { COLLAB } from '../engine/space';
import { normDoc, saveNow } from '../engine/storage';
import { setBg } from '../engine/chrome';
import { closeEditor } from '../engine/editing';
import { renderPanel } from '../engine/panel';
import { renderPhys } from '../engine/physics';
import { draw } from '../engine/render';
import { find } from '../engine/state-init';
import { applyTheme } from '../engine/theme';
import { Binder, fromB64, readDoc, toB64 } from './binding';
import { cursorsStart, cursorsStop, knownPeers, peerCursor, peerGone } from './cursors';

const LOCAL = 'local', REMOTE = 'remote', DBMERGE = 'db', SEED = 'seed';
const CHUNK = 48000;

export interface SessionCtx {
  backend: CloudBackend;
  me: { uid: string; email: string };
  /** the canvas changed because of this user (needs saving) */
  dirty(id: string): void;
  /** keep the encoded state in the device cache */
  cacheState(id: string, state: string): void;
}

interface Session {
  id: string; role: Role; ydoc: Y.Doc; binder: Binder; um: Y.UndoManager; room: Room | null;
  ctx: SessionCtx; me: PeerInfo; flushT: number; cacheT: number; cursorT: number; lastCursor: any;
  chunks: Map<string, string[]>; joined: boolean;
}
let S: Session | null = null;

const COLORS = ['#E5484D', '#F76B15', '#E2A336', '#30A46C', '#12A594', '#0090FF', '#6E56CF', '#D6409F'];
export function colorFor(uid: string) { let h = 0; for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0; return COLORS[h % COLORS.length]; }

export const liveId = () => (S ? S.id : null);
export const isLive = (id: string) => !!S && S.id === id;
export const liveRole = () => (S ? S.role : null);
export function encodeLive(id: string): string | null { return S && S.id === id ? toB64(Y.encodeStateAsUpdate(S.ydoc)) : null; }
/** Fold a state saved by someone else (from the database) into the live document. */
export function mergeIntoLive(id: string, state: string) { if (S && S.id === id) Y.applyUpdate(S.ydoc, fromB64(state), DBMERGE); }

// ---------- engine ← Y ----------
function patch(list: any[], next: any[]) {
  const by = new Map(list.map(o => [o.id, o]));
  return next.map(n => {
    const o = by.get(n.id); if (!o) return n;
    for (const k of Object.keys(o)) if (!(k in n)) delete o[k];
    return Object.assign(o, n);
  });
}
function applyToEngine(s: Session) {
  const nd = normDoc(readDoc(s.ydoc)), d = STATE.doc;
  if (d.name !== nd.name) {
    d.name = nd.name; const f = $('#fname') as HTMLInputElement;
    if (document.activeElement !== f) f.value = nd.name; document.title = nd.name + ' · FlowSpace';
  }
  d.edgeDef = nd.edgeDef;
  if (JSON.stringify(d.phys) !== JSON.stringify(nd.phys)) { d.phys = nd.phys; renderPhys(); }
  if (d.theme !== nd.theme) { d.theme = nd.theme; applyTheme(); }
  d.items = patch(d.items, nd.items); d.edges = patch(d.edges, nd.edges);
  if (d.bg !== nd.bg) setBg(nd.bg);
  for (const id of [...STATE.sel]) if (!find(id)) STATE.sel.delete(id);
  if (STATE.editing && !find(STATE.editing)) closeEditor();
  s.binder.remember(d);
  draw(); renderPanel(); saveNow();
}

// ---------- engine → Y ----------
function flush(s: Session) {
  clearTimeout(s.flushT); s.flushT = 0;
  if (s.role === 'viewer') return;
  s.binder.write(STATE.doc, LOCAL);
}
function undoButtons(s: Session) {
  ($('#undo') as HTMLButtonElement).disabled = !s.um.canUndo();
  ($('#redo') as HTMLButtonElement).disabled = !s.um.canRedo();
}

// ---------- room messages ----------
function sendDoc(s: Session, msg: any) {
  if (!s.room || s.role === 'viewer') return;
  const str = JSON.stringify(msg);
  if (str.length <= CHUNK) { s.room.sendDoc(msg); return; }
  const id = Math.random().toString(36).slice(2), n = Math.ceil(str.length / CHUNK);
  for (let i = 0; i < n; i++) s.room.sendDoc({ t: 'k', from: s.me.uid, id, i, n, s: str.slice(i * CHUNK, (i + 1) * CHUNK) });
}
function requestSync(s: Session, to?: string) {
  s.room?.sendAw({ t: 'sv', from: s.me.uid, to, sv: toB64(Y.encodeStateVector(s.ydoc)) });
}
function onDoc(s: Session, msg: any) {
  if (!msg || msg.from === s.me.uid) return;
  if (msg.t === 'k') {
    const parts = s.chunks.get(msg.id) || new Array(msg.n); parts[msg.i] = msg.s; s.chunks.set(msg.id, parts);
    if (parts.filter(x => x != null).length === msg.n) { s.chunks.delete(msg.id); onDoc(s, JSON.parse(parts.join(''))); }
    return;
  }
  if (msg.t === 'u' || (msg.t === 's2' && (!msg.to || msg.to === s.me.uid))) {
    try { Y.applyUpdate(s.ydoc, fromB64(msg.d), REMOTE); } catch (e) { console.warn('FlowSpace: bad update', e); }
  }
}
function onAw(s: Session, msg: any) {
  if (!msg || msg.from === s.me.uid) return;
  if (msg.t === 'sv') {
    if (msg.to && msg.to !== s.me.uid) return;
    if (s.role !== 'viewer') {
      const upd = Y.encodeStateAsUpdate(s.ydoc, fromB64(msg.sv));
      if (upd.length > 2) sendDoc(s, { t: 's2', from: s.me.uid, to: msg.from, d: toB64(upd) });
    }
    if (!msg.to) requestSync(s, msg.from); // and ask the newcomer for what only they have
    return;
  }
  if (msg.t === 'c') peerCursor(msg.from, msg);
}
function sendCursor(s: Session, p: { x: number; y: number } | null) {
  if (!s.room || !s.joined) return;
  const msg = { t: 'c', from: s.me.uid, x: p ? Math.round(p.x) : null, y: p ? Math.round(p.y) : null, sel: [...STATE.sel].slice(0, 60), ed: STATE.editing || null };
  s.lastCursor = msg;
  if (s.cursorT) return;
  s.cursorT = window.setTimeout(() => { s.cursorT = 0; if (S === s && s.lastCursor) s.room?.sendAw(s.lastCursor); }, 45);
}
let pointerHooked = false;
function hookPointer() {
  if (pointerHooked) return; pointerHooked = true;
  window.addEventListener('pagehide', () => { if (S) { flush(S); S.ctx.cacheState(S.id, toB64(Y.encodeStateAsUpdate(S.ydoc))); } });
  STATE.svg.addEventListener('pointermove', e => {
    if (!S || e.pointerType === 'touch') return;
    const r = STATE.svg.getBoundingClientRect();
    sendCursor(S, { x: (e.clientX - r.left - STATE.view.x) / STATE.view.k, y: (e.clientY - r.top - STATE.view.y) / STATE.view.k });
  });
  STATE.svg.addEventListener('pointerleave', () => { if (S) sendCursor(S, null); });
}

// ---------- lifecycle ----------
export function startLive(id: string, role: Role, state: string | null, ctx: SessionCtx) {
  if (S && S.id === id && S.role === role) return;
  stopLive();
  const ydoc = new Y.Doc(), binder = new Binder(ydoc);
  if (state) { try { Y.applyUpdate(ydoc, fromB64(state)); } catch (e) { console.warn('FlowSpace: bad saved state', e); } }
  const um = new Y.UndoManager([ydoc.getMap('meta'), ydoc.getMap('items'), ydoc.getMap('edges')], { trackedOrigins: new Set([LOCAL]), captureTimeout: 600000 });
  const me: PeerInfo = { uid: ctx.me.uid, email: ctx.me.email, color: colorFor(ctx.me.uid), role };
  const s: Session = { id, role, ydoc, binder, um, room: null, ctx, me, flushT: 0, cacheT: 0, cursorT: 0, lastCursor: null, chunks: new Map(), joined: false };
  S = s;

  const hasState = ydoc.getMap('meta').size > 0 || ydoc.getMap('items').size > 0;
  if (hasState) {
    const nd = normDoc(readDoc(ydoc));
    if (JSON.stringify(nd) !== JSON.stringify(STATE.doc)) {
      // the device copy is never older than the saved state, so for editors its differences are kept
      if (role === 'viewer') applyToEngine(s); else { binder.remember(nd); binder.write(STATE.doc, SEED); }
    } else binder.remember(STATE.doc);
  } else {
    binder.remember({ name: undefined, items: [], edges: [] } as any);
    if (role !== 'viewer') binder.write(STATE.doc, SEED); else binder.remember(STATE.doc);
  }

  ydoc.on('update', (u: Uint8Array, origin: unknown) => {
    if (S !== s) return;
    if (origin !== REMOTE) sendDoc(s, { t: 'u', from: me.uid, d: toB64(u) });
    if (origin !== LOCAL) applyToEngine(s);
    if (origin === LOCAL || origin === um || origin === SEED || origin === DBMERGE) { if (role !== 'viewer') ctx.dirty(id); }
    clearTimeout(s.cacheT); s.cacheT = window.setTimeout(() => { if (S === s) ctx.cacheState(id, toB64(Y.encodeStateAsUpdate(ydoc))); }, 800);
  });
  um.on('stack-item-added', () => undoButtons(s));
  um.on('stack-item-popped', () => undoButtons(s));

  COLLAB.active = true; COLLAB.readOnly = role === 'viewer';
  COLLAB.afterChange = () => { if (S !== s) return; flush(s); if (!STATE.drag) um.stopCapturing(); undoButtons(s); sendCursor(s, s.lastCursor && s.lastCursor.x != null ? s.lastCursor : null); };
  COLLAB.touched = () => { if (S !== s || s.flushT) return; s.flushT = window.setTimeout(() => { if (S === s) { flush(s); if (!STATE.drag) um.stopCapturing(); } }, 50); };
  COLLAB.undo = () => { if (S !== s) return; flush(s); um.stopCapturing(); um.undo(); undoButtons(s); };
  COLLAB.redo = () => { if (S !== s) return; flush(s); um.redo(); undoButtons(s); };
  STATE.app.classList.toggle('ro', role === 'viewer');
  if (role === 'viewer') { ($('#fname') as HTMLInputElement).readOnly = true; }
  undoButtons(s);

  hookPointer(); cursorsStart(() => S ? S.me.uid : '');
  setCloud({ live: 'connecting', liveRole: role, peers: [me] });
  s.room = ctx.backend.openRoom(id, me, {
    doc: m => { if (S === s) onDoc(s, m); },
    aw: m => { if (S === s) onAw(s, m); },
    presence: peers => {
      if (S !== s) return;
      const uniq = new Map<string, PeerInfo>(); for (const p of peers) if (p && p.uid) uniq.set(p.uid, p);
      if (!uniq.has(me.uid)) uniq.set(me.uid, me);
      for (const uid of knownPeers()) if (!uniq.has(uid)) peerGone(uid);
      setCloud({ peers: [...uniq.values()] });
    },
    status: st => {
      if (S !== s) return;
      const was = s.joined; s.joined = st === 'joined';
      setCloud({ live: st === 'joined' ? 'live' : st === 'closed' ? 'off' : 'connecting' });
      if (s.joined && !was) requestSync(s);
    },
  });
}

export function stopLive() {
  const s = S; if (!s) return;
  flush(s);
  try { s.ctx.cacheState(s.id, toB64(Y.encodeStateAsUpdate(s.ydoc))); } catch { /* ignore */ }
  S = null;
  clearTimeout(s.flushT); clearTimeout(s.cacheT); clearTimeout(s.cursorT);
  s.room?.close(); s.um.destroy(); s.ydoc.destroy();
  COLLAB.active = false; COLLAB.readOnly = false; COLLAB.afterChange = COLLAB.touched = COLLAB.undo = COLLAB.redo = undefined;
  STATE.app.classList.remove('ro'); ($('#fname') as HTMLInputElement).readOnly = false;
  ($('#undo') as HTMLButtonElement).disabled = !STATE.undoS.length; ($('#redo') as HTMLButtonElement).disabled = !STATE.redoS.length;
  cursorsStop();
  setCloud({ live: 'off', liveRole: null, peers: [] });
}
