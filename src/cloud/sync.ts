// Cloud saving. The engine keeps working on a per-account localStorage cache
// ('flowspace.u.<user id>.*'); this module mirrors that cache to the backend:
// debounced autosave, offline retry, version-checked writes with a conflict prompt,
// thumbnails, and one-click upload of the canvases stored in this browser.
import type { CloudBackend, CloudUser, CanvasFull, CanvasRow, CanvasWrite } from './backend';
import { isNetworkError } from './backend';
import { setCloud, useCloud, type SyncState } from './store';
import { STATE } from '../engine/state';
import { $ } from '../engine/dom';
import { toast } from '../engine/help';
import { schematicPNG, thumbnailPNG } from '../engine/export';
import { LOCAL_SPACE, OPENED, SPACE, setSpaceHooks, type SpaceHooks } from '../engine/space';
import { encodeLive, isLive, mergeIntoLive, startLive, stopLive, type SessionCtx } from '../collab/session';
import { mergeStates } from '../collab/binding';
import {
  currentCanvasId, deleteCanvas, indexList, newCanvas, normDoc, openCanvas, readCanvas, reloadIfOpen, renderFiles,
  saveIndex, sdel, setStatus, sget, sset, switchSpace,
} from '../engine/storage';

interface Meta {
  /** 'leave' = remove my membership of someone else's canvas */
  leave?: boolean;
  /** server version this device's cache is based on (absent = not on the server yet) */
  v?: number;
  dirty?: boolean;
  /** bumped on every local edit, so an edit made during a save isn't lost */
  seq?: number;
  del?: boolean;
  conflict?: boolean;
  /** last thumbnail upload (ms) */
  th?: number;
}

const PUSH_DELAY = 1200, RETRY_OFFLINE = 15000, RETRY_ERROR = 30000, THUMB_EVERY = 20000;
const LAST_USER = 'flowspace.lastUser';

let be: CloudBackend;
let user: CloudUser | null = null;
let ns = '';
let meta: Record<string, Meta> = {};
const remote = new Map<string, CanvasRow>();
let thumbUrl: Record<string, string> = {};
let pushT = 0, pushing = false, pushAgain = false, lastRefresh = 0;
let conflictRemote: CanvasFull | null = null;

// ---------- helpers ----------
const metaKey = () => ns + 'meta';
const saveMeta = () => sset(metaKey(), JSON.stringify(meta));
const M = (id: string) => (meta[id] ||= {});
const nodeCount = (doc: any) => (doc.items || []).filter((i: any) => i.type === 'node').length;
const yKey = (id: string) => ns + 'y.' + id;
function toWrite(id: string, o: { doc: any; view: any }): CanvasWrite {
  const w: CanvasWrite = { name: o.doc.name || 'Untitled canvas', doc: o.doc, view: o.view || null, node_count: nodeCount(o.doc) };
  const y = encodeLive(id) || sget(yKey(id)); if (y) w.ydoc = y;
  return w;
}
const roleOf = (id: string) => (remote.get(id)?.role) || 'owner';
const isCloud = () => SPACE.kind === 'cloud';
const menuOpen = () => $('#mFiles').classList.contains('show');

function statusText(): string {
  const s = useCloud.getState().sync;
  return s === 'saving' ? 'Saving…' : s === 'offline' ? 'Offline · saved on this device' : s === 'error' ? 'Not synced · retrying' : s === 'conflict' ? 'Sync conflict' : 'Saved';
}
function setSync(sync: SyncState, syncError = '') {
  setCloud({ sync, syncError });
  if (isCloud()) setStatus(statusText(), sync !== 'saved' && sync !== 'idle');
}

const HOOKS: SpaceHooks = {
  kind: 'cloud',
  get ns() { return ns; },
  label: 'in your account',
  newId: () => crypto.randomUUID(),
  get savedText() { return statusText(); },
  saved: id => { if (!isLive(id)) markDirty(id); }, // live canvases are marked by their Yjs session
  created: id => markDirty(id),
  deleted: id => {
    const m = M(id), leave = roleOf(id) !== 'owner';
    if (isLive(id)) stopLive();
    sdel(yKey(id));
    if (m.v == null && !leave) delete meta[id]; else { meta[id] = { v: m.v, del: true, leave }; }
    remote.delete(id); saveMeta(); schedulePush(300);
  },
  fetchDoc: id => fetchDoc(id),
  entryMeta: id => {
    const r = remote.get(id); if (!r) return undefined;
    return { nodes: r.node_count, thumbUrl: r.thumb_path ? thumbUrl[r.thumb_path] : undefined, shared: !!r.role && r.role !== 'owner' };
  },
  filesExtra: () => {
    const n = localPending().length;
    return n ? `<hr><button data-x="upload">Upload ${n} canvas${n > 1 ? 'es' : ''} from this browser<small>copies</small></button>` : '';
  },
  filesClick: el => {
    if (el.dataset.x === 'upload') { $('#mFiles').classList.remove('show'); setCloud({ dialog: 'upload' }); return true; }
    return false;
  },
};

// ---------- saving ----------
function markDirty(id: string) {
  if (roleOf(id) === 'viewer') return;
  const m = M(id); m.dirty = true; m.seq = (m.seq || 0) + 1; saveMeta();
  if (!useCloud.getState().conflict) setSync('saving');
  schedulePush(PUSH_DELAY);
}
function schedulePush(ms: number) { clearTimeout(pushT); pushT = window.setTimeout(push, ms); }

export async function push(): Promise<void> {
  if (!user) return;
  if (pushing) { pushAgain = true; return; }
  pushing = true; clearTimeout(pushT);
  const uid = user.id;
  let failure: unknown = null;
  try {
    for (const id of Object.keys(meta)) {
      if (!user || user.id !== uid) return;
      const m = meta[id]; if (!m || m.conflict) continue;
      try {
        if (m.del) { if (m.leave) await be.removeMember(id, uid); else await be.remove(id); delete meta[id]; saveMeta(); continue; }
        if (!m.dirty) continue;
        const seq = m.seq, o = readCanvas(id);
        if (!o) { m.dirty = false; saveMeta(); continue; }
        const w = toWrite(id, o);
        let v: number | null;
        if (m.v == null) {
          try { v = await be.insert(id, w); }
          catch (e: any) { if (e?.kind !== 'exists') throw e; v = null; }
        } else v = await be.update(id, w, m.v);
        if (v == null) v = await settle(id, w);
        if (v == null) continue; // conflict raised
        if (v < 0) { pushAgain = true; continue; } // merged someone else's saved changes: save again
        m.v = v; if (m.seq === seq) m.dirty = false; saveMeta();
        const r = remote.get(id);
        remote.set(id, { id, name: w.name, node_count: w.node_count, version: v, updated_at: new Date().toISOString(), thumb_path: r ? r.thumb_path : null });
        if (roleOf(id) !== 'owner') { /* thumbnails are the owner's */ }
        else if (id === currentCanvasId()) { if (Date.now() - (m.th || 0) > THUMB_EVERY) await thumb(id); }
        else if (!m.th && w.doc.items.length) await thumb(id, w.doc);
      } catch (e) { failure = e; if (isNetworkError(e) || (e as any)?.kind === 'auth') break; }
    }
  } finally {
    pushing = false;
  }
  if (pushAgain) { pushAgain = false; return push(); }
  if (useCloud.getState().conflict) setSync('conflict');
  else if (failure) {
    const net = isNetworkError(failure);
    setSync(net ? 'offline' : 'error', net ? '' : String((failure as any)?.message || failure));
    schedulePush(net ? RETRY_OFFLINE : RETRY_ERROR);
  } else if (Object.values(meta).some(m => m.dirty || m.del)) schedulePush(PUSH_DELAY);
  else setSync('saved');
}

/** The versioned write was refused: find out why and decide. Returns the version to adopt, or null after raising a conflict. */
async function settle(id: string, w: CanvasWrite): Promise<number | null> {
  const r = await be.get(id);
  if (!r) { // deleted on another device: keep this device's work rather than lose it
    const v = await be.insert(id, w); toast(`“${w.name}” was deleted elsewhere — saved it again`); return v;
  }
  if (JSON.stringify(r.doc) === JSON.stringify(w.doc) && r.name === w.name) return r.version;
  // both sides have a shared (Yjs) state: merge them, nothing is lost and nobody has to choose
  if (r.ydoc && isLive(id)) { mergeIntoLive(id, r.ydoc); M(id).v = r.version; saveMeta(); return -1; }
  if (r.ydoc && sget(yKey(id))) {
    const mg = mergeStates(sget(yKey(id)), r.ydoc), o = readCanvas(id);
    sset(ns + 'doc.' + id, JSON.stringify({ doc: normDoc(mg.doc), view: o ? o.view : r.view || null })); sset(yKey(id), mg.state);
    M(id).v = r.version; saveMeta(); return -1;
  }
  conflictRemote = r; M(id).conflict = true; saveMeta();
  setCloud({ conflict: { id, name: w.name } });
  return null;
}

export function resolveConflict(choice: 'theirs' | 'mine' | 'both') {
  const c = useCloud.getState().conflict, r = conflictRemote; if (!c || !r) return;
  const m = M(c.id), mine = readCanvas(c.id);
  conflictRemote = null; m.conflict = false; setCloud({ conflict: null });
  if (choice === 'mine') { m.v = r.version; m.dirty = true; saveMeta(); setSync('saving'); push(); return; }
  if (choice === 'both' && mine) {
    const id2 = crypto.randomUUID(), doc = { ...mine.doc, name: mine.doc.name + ' (my copy)' };
    sset(ns + 'doc.' + id2, JSON.stringify({ doc, view: mine.view })); indexList().push({ id: id2, name: doc.name, updated: Date.now() });
    meta[id2] = { dirty: true, seq: 1 };
  }
  writeCache(r); saveIndex(); saveMeta(); reloadIfOpen(c.id);
  if (choice === 'both') toast(`Kept both — your version is “${mine ? mine.doc.name + ' (my copy)' : ''}”`);
  else toast('Loaded the latest version');
  if (menuOpen()) renderFiles();
  setSync('saving'); push();
}

function writeCache(r: CanvasFull) {
  sset(ns + 'doc.' + r.id, JSON.stringify({ doc: normDoc({ ...r.doc, name: r.name }), view: r.view || null }));
  if (r.ydoc) sset(yKey(r.id), r.ydoc); else sdel(yKey(r.id));
  meta[r.id] = { v: r.version };
  const ent = indexList().find(x => x.id === r.id);
  if (ent) { ent.name = r.name; ent.updated = Date.parse(r.updated_at) || ent.updated; }
  remote.set(r.id, { id: r.id, name: r.name, updated_at: r.updated_at, node_count: r.node_count, thumb_path: r.thumb_path, version: r.version, role: r.role || remote.get(r.id)?.role });
}

async function fetchDoc(id: string): Promise<boolean> {
  try {
    const r = await be.get(id); if (!r) return false;
    writeCache(r); saveIndex(); saveMeta();
    if (!r.thumb_path) setTimeout(() => { if (currentCanvasId() === id) thumb(id).catch(() => {}); }, 1500);
    return true;
  } catch (e) { if (isNetworkError(e)) setSync('offline'); return false; }
}

/** Full render for the open canvas; the schematic thumbnail for any other canvas (pass its doc). */
async function thumb(id: string, doc?: any) {
  if (!user) return;
  let png: Blob | null;
  if (doc) png = await schematicPNG(doc);
  else { if (id !== currentCanvasId() || !STATE.doc.items.length) return; png = await thumbnailPNG(); }
  if (!png) return;
  const path = await be.putThumb(user.id, id, png);
  M(id).th = Date.now(); saveMeta();
  const r = remote.get(id); if (r) r.thumb_path = path;
}

// ---------- refreshing from the server ----------
export async function refresh(force = false) {
  if (!user || (!force && Date.now() - lastRefresh < 10000)) return;
  lastRefresh = Date.now();
  let rows: CanvasRow[];
  try { rows = await be.list(); } catch (e) { if (isNetworkError(e)) setSync('offline'); return; }
  if (!user || !isCloud()) return;
  const list = indexList(), cur = currentCanvasId(), seen = new Set<string>();
  let curGone = false, curStale = false;
  for (const r of rows) {
    seen.add(r.id); remote.set(r.id, r);
    const m = meta[r.id] || {};
    if (m.del) continue;
    let ent = list.find(x => x.id === r.id);
    if (!ent) { ent = { id: r.id, name: r.name, updated: Date.parse(r.updated_at) }; list.push(ent); }
    if (m.dirty) continue;
    ent.name = r.name; ent.updated = Date.parse(r.updated_at) || ent.updated;
    if (m.v !== r.version && sget(ns + 'doc.' + r.id) != null) {
      if (r.id === cur) curStale = true; else { sdel(ns + 'doc.' + r.id); sdel(yKey(r.id)); delete meta[r.id]; }
    }
  }
  for (const ent of [...list]) {
    const m = meta[ent.id];
    if (seen.has(ent.id) || !m || m.v == null || m.dirty) continue; // not on the server yet: will be uploaded
    list.splice(list.indexOf(ent), 1); sdel(ns + 'doc.' + ent.id); sdel(yKey(ent.id)); delete meta[ent.id];
    if (ent.id === cur) curGone = true;
  }
  saveIndex(); saveMeta();
  if (curGone) { stopLive(); toast('This canvas was deleted or is no longer shared with you'); switchSpace(HOOKS); }
  else if (curStale && isLive(cur)) {
    try { const r = await be.get(cur); if (r && r.ydoc) { mergeIntoLive(cur, r.ydoc); if (!M(cur).dirty) M(cur).v = r.version; saveMeta(); } } catch { /* next time */ }
  }
  else if (curStale && await fetchDoc(cur)) { reloadIfOpen(cur); toast('Updated with changes from another device'); }
  const paths = rows.filter(r => r.thumb_path && !thumbUrl[r.thumb_path]).map(r => r.thumb_path as string);
  if (paths.length) { try { Object.assign(thumbUrl, await be.thumbUrls(paths)); } catch { /* thumbnails are optional */ } }
  setCloud({ uploadable: localPending().length });
  if (menuOpen()) renderFiles();
}

// ---------- uploading local canvases ----------
// kept outside the account cache (which is cleared on sign-out) so the same canvases are never offered twice
const uploadedKey = () => `flowspace.uploaded.${user ? user.id : ''}`;
const askedKey = () => `flowspace.uploadAsked.${user ? user.id : ''}`;
function localPending(): { id: string; name: string }[] {
  if (!user) return [];
  let ix: any = null; try { ix = JSON.parse(sget(LOCAL_SPACE.ns + 'index') || 'null'); } catch { /* empty */ }
  if (!ix || !Array.isArray(ix.list)) return [];
  let done: Record<string, string> = {}; try { done = JSON.parse(sget(uploadedKey()) || '{}'); } catch { /* empty */ }
  return ix.list.filter((x: any) => !done[x.id] && sget(LOCAL_SPACE.ns + 'doc.' + x.id) != null);
}
export const pendingUploads = () => localPending();

export function uploadLocal(): number {
  const todo = localPending(); if (!todo.length || !isCloud()) return 0;
  let done: Record<string, string> = {}; try { done = JSON.parse(sget(uploadedKey()) || '{}'); } catch { /* empty */ }
  const list = indexList();
  // an untouched blank canvas that was only created because the account was empty is replaced
  const blank = list.length === 1 && (() => { const o = readCanvas(list[0].id); return o && !o.doc.items.length && o.doc.name === 'Untitled canvas'; })() ? list[0].id : null;
  let first = '';
  todo.forEach((x, i) => {
    let o: any = null; try { o = JSON.parse(sget(LOCAL_SPACE.ns + 'doc.' + x.id) || 'null'); } catch { /* skip */ }
    if (!o || !o.doc) return;
    const id = crypto.randomUUID(); first ||= id;
    sset(ns + 'doc.' + id, JSON.stringify({ doc: o.doc, view: o.view || null }));
    list.push({ id, name: o.doc.name || x.name, updated: Date.now() - i });
    meta[id] = { dirty: true, seq: 1 }; done[x.id] = id;
  });
  sset(uploadedKey(), JSON.stringify(done)); saveIndex(); saveMeta();
  if (blank && first) deleteCanvas(blank);
  if (first) openCanvas(first);
  setCloud({ uploadable: 0 }); setSync('saving'); push();
  toast(`Uploading ${todo.length} canvas${todo.length > 1 ? 'es' : ''} to your account`);
  return todo.length;
}

// ---------- sessions ----------
function readMeta() { try { meta = JSON.parse(sget(metaKey()) || '{}') || {}; } catch { meta = {}; } }

async function startSession(u: CloudUser) {
  if (user && user.id === u.id) { if (!isCloud()) switchSpace(HOOKS); return; }
  user = u; ns = `flowspace.u.${u.id}.`; readMeta(); remote.clear(); thumbUrl = {}; lastRefresh = 0;
  sset(LAST_USER, u.id);
  setCloud({ user: u, conflict: null });
  if (sget(ns + 'index') == null) {
    setStatus('Loading your canvases…', true);
    try {
      const rows = await be.list();
      for (const r of rows) remote.set(r.id, r);
      sset(ns + 'index', JSON.stringify({ current: rows[0] ? rows[0].id : null, list: rows.map(r => ({ id: r.id, name: r.name, updated: Date.parse(r.updated_at) })) }));
      lastRefresh = Date.now();
    } catch (e) { if (isNetworkError(e)) setSync('offline'); }
  }
  if (!user || user.id !== u.id) return;
  if (!isCloud() || SPACE !== HOOKS) switchSpace(HOOKS);
  setSync(Object.values(meta).some(m => m.dirty || m.del) ? 'saving' : 'saved');
  await refresh(true); push();
  if (isCloud()) { const c = currentCanvasId(); if (c) opened(c); }
  await handleJoin();
  const n = localPending().length;
  setCloud({ uploadable: n });
  if (n && sget(askedKey()) == null) { sset(askedKey(), '1'); setCloud({ dialog: 'upload' }); }
}

function endSession(clearCache: boolean) {
  const old = ns;
  stopLive();
  user = null; meta = {}; remote.clear(); thumbUrl = {}; conflictRemote = null; clearTimeout(pushT);
  sdel(LAST_USER);
  if (isCloud()) switchSpace(LOCAL_SPACE);
  if (clearCache && old) {
    const ks: string[] = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(old)) ks.push(k); } } catch { /* ignore */ }
    ks.forEach(k => sdel(k));
  }
  setCloud({ user: null, sync: 'idle', conflict: null, uploadable: 0 });
}

/** Changes that have not reached the server yet (shown before signing out). */
export const unsyncedCount = () => Object.values(meta).filter(m => m.dirty || m.del || m.conflict).length;

export async function flush(timeoutMs = 6000) {
  await Promise.race([push(), new Promise(r => setTimeout(r, timeoutMs))]);
}

export async function signOut() {
  await be.signOut().catch(() => {});
  endSession(true);
  toast('Signed out — showing canvases stored in this browser');
}

/**
 * Called before the engine mounts: if this browser was signed in last time and has that account's cache,
 * open the cloud space straight away (no flash of the local canvases). The session is verified right after.
 */
export function preselectSpace() {
  const id = sget(LAST_USER);
  if (!id || sget(`flowspace.u.${id}.index`) == null) return;
  ns = `flowspace.u.${id}.`; readMeta();
  // the space is selected before a session exists; startSession() fills in the user
  setSpaceHooks(HOOKS);
}

// ---------- live sessions & share links ----------
const ctx = (): SessionCtx => ({
  backend: be, me: { uid: user!.id, email: user!.email },
  dirty: id => markDirty(id),
  cacheState: (id, st) => { if (user && sget(ns + 'doc.' + id) != null) sset(yKey(id), st); },
});
function opened(id: string) {
  if (!user || !isCloud()) { stopLive(); return; }
  startLive(id, roleOf(id), sget(yKey(id)), ctx());
}
const JOIN_KEY = 'flowspace.pendingJoin';
async function handleJoin() {
  const token = sget(JOIN_KEY); if (!token || !user) return;
  sdel(JOIN_KEY); setCloud({ joinPending: false });
  try {
    const { canvasId, role } = await be.join(token);
    lastRefresh = 0; await refresh(true);
    if (!indexList().some(x => x.id === canvasId)) { const r = remote.get(canvasId); indexList().push({ id: canvasId, name: r ? r.name : 'Shared canvas', updated: Date.now() }); saveIndex(); }
    if (currentCanvasId() !== canvasId) openCanvas(canvasId); else opened(canvasId);
    const name = remote.get(canvasId)?.name || 'the canvas';
    toast(role === 'viewer' ? `Opened “${name}” — view only` : role === 'owner' ? `“${name}” is your own canvas` : `Opened “${name}” — you can edit`);
  } catch (e: any) { toast(e?.message || 'Couldn’t open that link'); }
}
/** Make sure a canvas exists on the server (before sharing it). */
export async function ensureOnServer(id: string): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    if (M(id).v != null && !M(id).dirty) return true;
    await push(); if (M(id).v != null) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return M(id).v != null;
}
export const backendRef = () => be;
export const currentUser = () => user;
export const roleOfCanvas = (id: string) => roleOf(id);
export function afterLeave(id: string) {
  if (!indexList().some(x => x.id === id)) return;
  if (indexList().length < 2) newCanvas();
  deleteCanvas(id);
}

export async function initSync(backend: CloudBackend) {
  be = backend;
  OPENED.fn = id => { if (user && isCloud()) opened(id); else stopLive(); };
  const jt = new URLSearchParams(window.location.search).get('join');
  if (jt) { sset(JOIN_KEY, jt); const u = new URL(window.location.href); u.searchParams.delete('join'); window.history.replaceState(null, '', u.pathname + u.search + u.hash); }
  backend.onAuth((ev, u) => {
    if (ev === 'SIGNED_OUT') { if (user) endSession(false); return; }
    if (ev === 'PASSWORD_RECOVERY') setCloud({ dialog: 'newpw' });
    if (u) startSession(u);
  });
  const u = await backend.getUser();
  setCloud({ ready: true });
  if (u) await startSession(u);
  else {
    if (isCloud()) endSession(false);
    if (sget(JOIN_KEY)) setCloud({ dialog: 'signin', joinPending: true });
  }
  window.addEventListener('online', () => { refresh(true); push(); });
  window.addEventListener('focus', () => { refresh(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') push(); else refresh(); });
}
