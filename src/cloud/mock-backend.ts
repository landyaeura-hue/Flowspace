// In-browser stand-in for Supabase, used only by local tests (build with VITE_CLOUD_MOCK=1).
// Mirrors the server rules of supabase/migrations/0001_canvases.sql: per-user rows,
// version bumped only when name or doc change, "update where version = n".
import { CloudError, type AuthEvent, type CanvasFull, type CanvasWrite, type CloudBackend, type CloudUser, type PeerInfo, type Person, type Role, type Room, type RoomHandlers, type ShareLink } from './backend';

interface Row extends CanvasFull { owner_id: string }
interface DB {
  users: Record<string, { id: string; password: string }>; rows: Record<string, Row>; thumbs: Record<string, string>;
  members?: Record<string, Record<string, 'editor' | 'viewer'>>; links?: Record<string, { cid: string; role: 'editor' | 'viewer' }>;
}

const KEY = 'mockcloud.db', SKEY = 'mockcloud.session';
const load = (): DB => { let d: DB; try { d = JSON.parse(localStorage.getItem(KEY) || '') as DB; } catch { d = { users: {}, rows: {}, thumbs: {} }; } d.members ||= {}; d.links ||= {}; return d; };
// sessions are per tab, so two tabs of one browser can be two different people in tests
const sess = () => sessionStorage;
function roleOf(db: DB, cid: string, uid: string): Role | null {
  const r = db.rows[cid]; if (!r) return null;
  if (r.owner_id === uid) return 'owner';
  return (db.members![cid] || {})[uid] || null;
}
const emailOf = (db: DB, uid: string) => Object.keys(db.users).find(e => db.users[e].id === uid) || '';
const save = (db: DB) => localStorage.setItem(KEY, JSON.stringify(db));
const wait = () => new Promise(r => setTimeout(r, 60));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export const mockControl = { offline: false, calls: [] as string[] };

export class MemoryBackend implements CloudBackend {
  readonly name = 'mock';
  private listeners: ((e: AuthEvent, u: CloudUser | null) => void)[] = [];
  private async net(op: string) {
    await wait(); mockControl.calls.push(op);
    if (mockControl.offline) throw new CloudError('Can’t reach the server', 'network');
  }
  private me(): CloudUser {
    const s = sess().getItem(SKEY); if (!s) throw new CloudError('Not signed in', 'auth');
    return JSON.parse(s);
  }
  private emit(e: AuthEvent, u: CloudUser | null) { for (const l of this.listeners) setTimeout(() => l(e, u), 0); }

  async getUser() { const s = sess().getItem(SKEY); return s ? JSON.parse(s) as CloudUser : null; }
  onAuth(cb: (e: AuthEvent, u: CloudUser | null) => void) { this.listeners.push(cb); }
  async signIn(email: string, password: string) {
    await this.net('signIn'); const db = load(), u = db.users[email.toLowerCase()];
    if (!u || u.password !== password) throw new CloudError('Invalid login credentials');
    const user = { id: u.id, email: email.toLowerCase() }; sess().setItem(SKEY, JSON.stringify(user)); this.emit('SIGNED_IN', user);
  }
  async signUp(email: string, password: string) {
    await this.net('signUp'); const db = load(), k = email.toLowerCase();
    if (db.users[k]) throw new CloudError('An account with this email already exists — sign in instead');
    if (password.length < 6) throw new CloudError('Password should be at least 6 characters.');
    db.users[k] = { id: crypto.randomUUID(), password }; save(db);
    const user = { id: db.users[k].id, email: k }; sess().setItem(SKEY, JSON.stringify(user)); this.emit('SIGNED_IN', user);
    return 'signed-in' as const;
  }
  async sendMagicLink() { await this.net('magic'); }
  async resetPassword() { await this.net('reset'); }
  async updatePassword(password: string) { await this.net('updatePassword'); const db = load(), me = this.me(); db.users[me.email].password = password; save(db); }
  async signOut() { sess().removeItem(SKEY); this.emit('SIGNED_OUT', null); }

  async list() {
    await this.net('list'); const me = this.me();
    const db = load();
    return Object.values(db.rows).filter(r => roleOf(db, r.id, me.id)).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(({ id, name, updated_at, node_count, thumb_path, version }) => ({ id, name, updated_at, node_count, thumb_path, version, role: roleOf(db, id, me.id) as Role }));
  }
  async get(id: string) {
    await this.net('get'); const me = this.me(), db = load(), r = db.rows[id];
    if (!r || !roleOf(db, id, me.id)) return null;
    const { owner_id, ...rest } = r; void owner_id; return clone(rest);
  }
  async insert(id: string, w: CanvasWrite) {
    await this.net('insert'); const me = this.me(), db = load();
    if (db.rows[id]) throw new CloudError('duplicate key', 'exists');
    db.rows[id] = { id, owner_id: me.id, ...clone(w), thumb_path: null, version: 1, updated_at: new Date().toISOString() }; save(db); return 1;
  }
  async update(id: string, w: CanvasWrite, version: number) {
    await this.net('update'); const me = this.me(), db = load(), r = db.rows[id];
    const role = roleOf(db, id, me.id);
    if (!r || (role !== 'owner' && role !== 'editor') || r.version !== version) return null;
    const edited = JSON.stringify(r.doc) !== JSON.stringify(w.doc) || r.name !== w.name;
    Object.assign(r, clone(w)); if (edited) { r.version++; r.updated_at = new Date().toISOString(); }
    save(db); return r.version;
  }
  async remove(id: string) {
    await this.net('remove'); const me = this.me(), db = load(), r = db.rows[id];
    if (r && r.owner_id === me.id) { if (r.thumb_path) delete db.thumbs[r.thumb_path]; delete db.rows[id]; delete db.members![id]; for (const t in db.links) if (db.links![t].cid === id) delete db.links![t]; save(db); }
  }
  async putThumb(userId: string, id: string, png: Blob) {
    await this.net('putThumb'); const db = load(), path = `${userId}/${id}.png`;
    db.thumbs[path] = await new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(png); });
    if (db.rows[id]) db.rows[id].thumb_path = path; save(db); return path;
  }
  async thumbUrls(paths: string[]) {
    await this.net('thumbUrls'); const db = load(), out: Record<string, string> = {};
    for (const p of paths) if (db.thumbs[p]) out[p] = db.thumbs[p];
    return out;
  }

  async people(cid: string) {
    await this.net('people'); const me = this.me(), db = load(), r = db.rows[cid];
    if (!r || !roleOf(db, cid, me.id)) return [];
    const out: Person[] = [{ user_id: r.owner_id, email: emailOf(db, r.owner_id), role: 'owner' }];
    for (const [uid, role] of Object.entries(db.members![cid] || {})) out.push({ user_id: uid, email: emailOf(db, uid), role });
    return out;
  }
  async links(cid: string) {
    await this.net('links'); const me = this.me(), db = load();
    if (roleOf(db, cid, me.id) !== 'owner') return [];
    return Object.entries(db.links!).filter(([, l]) => l.cid === cid).map(([token, l]) => ({ token, role: l.role })) as ShareLink[];
  }
  async createLink(cid: string, role: 'editor' | 'viewer', token: string) {
    await this.net('createLink'); const me = this.me(), db = load();
    if (roleOf(db, cid, me.id) !== 'owner') throw new CloudError('new row violates row-level security policy');
    if (Object.values(db.links!).some(l => l.cid === cid && l.role === role)) throw new CloudError('duplicate key', 'exists');
    db.links![token] = { cid, role }; save(db);
  }
  async deleteLink(cid: string, role: 'editor' | 'viewer') {
    await this.net('deleteLink'); const me = this.me(), db = load();
    if (roleOf(db, cid, me.id) !== 'owner') return;
    for (const t in db.links) if (db.links![t].cid === cid && db.links![t].role === role) delete db.links![t];
    save(db);
  }
  async setRole(cid: string, uid: string, role: 'editor' | 'viewer') {
    await this.net('setRole'); const me = this.me(), db = load();
    if (roleOf(db, cid, me.id) !== 'owner' || !(db.members![cid] || {})[uid]) return;
    db.members![cid][uid] = role; save(db);
  }
  async removeMember(cid: string, uid: string) {
    await this.net('removeMember'); const me = this.me(), db = load();
    if (roleOf(db, cid, me.id) !== 'owner' && uid !== me.id) return;
    if (db.members![cid]) delete db.members![cid][uid]; save(db);
  }
  async join(token: string) {
    await this.net('join'); const me = this.me(), db = load(), l = db.links![token];
    if (!l || !db.rows[l.cid]) throw new CloudError('This share link has been turned off');
    const cur = roleOf(db, l.cid, me.id);
    if (cur === 'owner' || cur === 'editor' || cur === l.role) return { canvasId: l.cid, role: cur as Role };
    (db.members![l.cid] ||= {})[me.id] = l.role; save(db);
    return { canvasId: l.cid, role: l.role as Role };
  }
  openRoom(cid: string, me: PeerInfo, h: RoomHandlers): Room {
    const docBC = new BroadcastChannel(`mockrt:${cid}:doc`), awBC = new BroadcastChannel(`mockrt:${cid}:aw`);
    const peers = new Map<string, { info: PeerInfo; seen: number }>();
    let closed = false, joined = false;
    const allowed = () => { const r = roleOf(load(), cid, me.uid); return r; };
    const emitPresence = () => h.presence([me, ...[...peers.values()].map(p => p.info).filter(p => p.uid !== me.uid)]);
    const hello = (kind: string) => awBC.postMessage({ _p: kind, info: me });
    docBC.onmessage = e => { if (!closed && joined && !mockControl.offline) h.doc(e.data); };
    awBC.onmessage = e => {
      if (closed || !joined || mockControl.offline) return;
      const m = e.data;
      if (m && m._p) {
        if (m._p === 'bye') { peers.delete(m.info.uid); emitPresence(); return; }
        const isNew = !peers.has(m.info.uid); peers.set(m.info.uid, { info: m.info, seen: Date.now() });
        if (m._p === 'hello') hello('here');
        if (isNew) emitPresence();
        return;
      }
      h.aw(m);
    };
    const tick = () => {
      if (closed) return;
      const ok = !mockControl.offline && !!allowed();
      if (ok && !joined) { joined = true; h.status('joined'); hello('hello'); emitPresence(); }
      else if (!ok && joined) { joined = false; peers.clear(); h.status('error'); }
      if (joined) { hello('here'); let gone = false; for (const [k, p] of peers) if (Date.now() - p.seen > 5000) { peers.delete(k); gone = true; } if (gone) emitPresence(); }
    };
    const timer = setInterval(tick, 1000); setTimeout(tick, 80);
    return {
      sendDoc: msg => { const r = allowed(); if (!closed && joined && (r === 'owner' || r === 'editor')) docBC.postMessage(msg); },
      sendAw: msg => { if (!closed && joined) awBC.postMessage(msg); },
      close: () => { if (joined) hello('bye'); closed = true; clearInterval(timer); docBC.close(); awBC.close(); h.status('closed'); },
    };
  }
}


/** Test helper: simulate an edit made on another device. */
export function mockEditElsewhere(id: string, mutate: (r: CanvasFull) => void) {
  const db = load(), r = db.rows[id]; if (!r) return false;
  mutate(r); r.version++; r.updated_at = new Date().toISOString(); save(db); return true;
}
