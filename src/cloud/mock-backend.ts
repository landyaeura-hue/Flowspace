// In-browser stand-in for Supabase, used only by local tests (build with VITE_CLOUD_MOCK=1).
// Mirrors the server rules of supabase/migrations/0001_canvases.sql: per-user rows,
// version bumped only when name or doc change, "update where version = n".
import { CloudError, type AuthEvent, type CanvasFull, type CanvasWrite, type CloudBackend, type CloudUser } from './backend';

interface Row extends CanvasFull { owner_id: string }
interface DB { users: Record<string, { id: string; password: string }>; rows: Record<string, Row>; thumbs: Record<string, string> }

const KEY = 'mockcloud.db', SKEY = 'mockcloud.session';
const load = (): DB => { try { return JSON.parse(localStorage.getItem(KEY) || '') as DB; } catch { return { users: {}, rows: {}, thumbs: {} }; } };
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
    const s = localStorage.getItem(SKEY); if (!s) throw new CloudError('Not signed in', 'auth');
    return JSON.parse(s);
  }
  private emit(e: AuthEvent, u: CloudUser | null) { for (const l of this.listeners) setTimeout(() => l(e, u), 0); }

  async getUser() { const s = localStorage.getItem(SKEY); return s ? JSON.parse(s) as CloudUser : null; }
  onAuth(cb: (e: AuthEvent, u: CloudUser | null) => void) { this.listeners.push(cb); }
  async signIn(email: string, password: string) {
    await this.net('signIn'); const db = load(), u = db.users[email.toLowerCase()];
    if (!u || u.password !== password) throw new CloudError('Invalid login credentials');
    const user = { id: u.id, email: email.toLowerCase() }; localStorage.setItem(SKEY, JSON.stringify(user)); this.emit('SIGNED_IN', user);
  }
  async signUp(email: string, password: string) {
    await this.net('signUp'); const db = load(), k = email.toLowerCase();
    if (db.users[k]) throw new CloudError('An account with this email already exists — sign in instead');
    if (password.length < 6) throw new CloudError('Password should be at least 6 characters.');
    db.users[k] = { id: crypto.randomUUID(), password }; save(db);
    const user = { id: db.users[k].id, email: k }; localStorage.setItem(SKEY, JSON.stringify(user)); this.emit('SIGNED_IN', user);
    return 'signed-in' as const;
  }
  async sendMagicLink() { await this.net('magic'); }
  async resetPassword() { await this.net('reset'); }
  async updatePassword(password: string) { await this.net('updatePassword'); const db = load(), me = this.me(); db.users[me.email].password = password; save(db); }
  async signOut() { localStorage.removeItem(SKEY); this.emit('SIGNED_OUT', null); }

  async list() {
    await this.net('list'); const me = this.me();
    return Object.values(load().rows).filter(r => r.owner_id === me.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(({ id, name, updated_at, node_count, thumb_path, version }) => ({ id, name, updated_at, node_count, thumb_path, version }));
  }
  async get(id: string) {
    await this.net('get'); const me = this.me(), r = load().rows[id];
    if (!r || r.owner_id !== me.id) return null;
    const { owner_id, ...rest } = r; void owner_id; return clone(rest);
  }
  async insert(id: string, w: CanvasWrite) {
    await this.net('insert'); const me = this.me(), db = load();
    if (db.rows[id]) throw new CloudError('duplicate key', 'exists');
    db.rows[id] = { id, owner_id: me.id, ...clone(w), thumb_path: null, version: 1, updated_at: new Date().toISOString() }; save(db); return 1;
  }
  async update(id: string, w: CanvasWrite, version: number) {
    await this.net('update'); const me = this.me(), db = load(), r = db.rows[id];
    if (!r || r.owner_id !== me.id || r.version !== version) return null;
    const edited = JSON.stringify(r.doc) !== JSON.stringify(w.doc) || r.name !== w.name;
    Object.assign(r, clone(w)); if (edited) { r.version++; r.updated_at = new Date().toISOString(); }
    save(db); return r.version;
  }
  async remove(id: string) {
    await this.net('remove'); const me = this.me(), db = load(), r = db.rows[id];
    if (r && r.owner_id === me.id) { if (r.thumb_path) delete db.thumbs[r.thumb_path]; delete db.rows[id]; save(db); }
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
}

/** Test helper: simulate an edit made on another device. */
export function mockEditElsewhere(id: string, mutate: (r: CanvasFull) => void) {
  const db = load(), r = db.rows[id]; if (!r) return false;
  mutate(r); r.version++; r.updated_at = new Date().toISOString(); save(db); return true;
}
