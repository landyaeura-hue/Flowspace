import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { CloudError, isNetworkError, type AuthEvent, type CanvasFull, type CanvasRow, type CanvasWrite, type CloudBackend, type CloudUser, type PeerInfo, type Person, type Role, type Room, type RoomHandlers, type ShareLink } from './backend';

const LIST_COLS = 'id,name,updated_at,node_count,thumb_path,version';
const BUCKET = 'thumbnails';

function fail(err: any): never {
  if (!err) throw new CloudError('Unknown error');
  if (err instanceof CloudError) throw err;
  const msg = String(err.message || err.error_description || err);
  if (isNetworkError(err) || err.status === 0) throw new CloudError('Can’t reach the server', 'network');
  if (err.code === '23505') throw new CloudError(msg, 'exists');
  if (err.status === 401 || err.code === 'PGRST301' || /JWT/i.test(msg)) throw new CloudError('Your session expired — sign in again', 'auth');
  throw new CloudError(msg);
}
const toUser = (u: User | null | undefined): CloudUser | null => (u ? { id: u.id, email: u.email || '' } : null);
/** where email links (confirm, magic link, reset) come back to */
const backUrl = () => window.location.origin + window.location.pathname;

export class SupabaseBackend implements CloudBackend {
  readonly name = 'supabase';
  private sb: SupabaseClient;
  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }

  async getUser() {
    const { data, error } = await this.sb.auth.getSession();
    if (error) return null;
    return toUser(data.session?.user);
  }
  onAuth(cb: (event: AuthEvent, user: CloudUser | null) => void) {
    this.sb.auth.onAuthStateChange((event, session) => {
      const ev: AuthEvent = event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY' ? event : 'OTHER';
      // never call Supabase inside this callback (it can deadlock); hand off to the next tick
      setTimeout(() => cb(ev, toUser(session?.user)), 0);
    });
  }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) fail(error);
  }
  async signUp(email: string, password: string) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: backUrl() } });
    if (error) fail(error);
    // with "Confirm email" on, Supabase returns a user with no identities when the address is already registered
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new CloudError('An account with this email already exists — sign in instead');
    return data.session ? 'signed-in' : 'confirm';
  }
  async sendMagicLink(email: string) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: backUrl(), shouldCreateUser: true } });
    if (error) fail(error);
  }
  async resetPassword(email: string) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: backUrl() });
    if (error) fail(error);
  }
  async updatePassword(password: string) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) fail(error);
  }
  async signOut() {
    const { error } = await this.sb.auth.signOut({ scope: 'local' });
    if (error && !isNetworkError(error)) fail(error);
  }

  private async uid() {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id; if (!id) throw new CloudError('Sign in again', 'auth');
    return id;
  }
  async list(): Promise<CanvasRow[]> {
    const me = await this.uid();
    const [c, m] = await Promise.all([
      this.sb.from('canvases').select(LIST_COLS + ',owner_id').order('updated_at', { ascending: false }),
      this.sb.from('canvas_members').select('canvas_id,role').eq('user_id', me),
    ]);
    if (c.error) fail(c.error);
    const roles = new Map<string, Role>();
    if (!m.error) for (const r of (m.data || []) as { canvas_id: string; role: Role }[]) roles.set(r.canvas_id, r.role);
    return ((c.data || []) as unknown as (CanvasRow & { owner_id: string })[]).map(({ owner_id, ...r }) => ({ ...r, role: owner_id === me ? 'owner' : roles.get(r.id) || 'viewer' }));
  }
  async get(id: string): Promise<CanvasFull | null> {
    const { data, error } = await this.sb.from('canvases').select(LIST_COLS + ',doc,view,ydoc').eq('id', id).maybeSingle();
    if (error) fail(error);
    return (data as unknown as CanvasFull) || null;
  }
  async insert(id: string, w: CanvasWrite) {
    const { data, error } = await this.sb.from('canvases').insert({ id, ...w }).select('version').single();
    if (error) fail(error);
    return (data as { version: number }).version;
  }
  async update(id: string, w: CanvasWrite, version: number) {
    const { data, error } = await this.sb.from('canvases').update(w).eq('id', id).eq('version', version).select('version');
    if (error) fail(error);
    const rows = (data || []) as { version: number }[];
    return rows.length ? rows[0].version : null;
  }
  async remove(id: string) {
    const { data, error } = await this.sb.from('canvases').delete().eq('id', id).select('thumb_path');
    if (error) fail(error);
    const paths = ((data || []) as { thumb_path: string | null }[]).map(r => r.thumb_path).filter(Boolean) as string[];
    if (paths.length) await this.sb.storage.from(BUCKET).remove(paths); // best effort
  }
  async putThumb(userId: string, id: string, png: Blob) {
    const path = `${userId}/${id}.png`;
    const up = await this.sb.storage.from(BUCKET).upload(path, png, { upsert: true, contentType: 'image/png', cacheControl: '60' });
    if (up.error) fail(up.error);
    const { error } = await this.sb.from('canvases').update({ thumb_path: path }).eq('id', id);
    if (error) fail(error);
    return path;
  }
  async people(canvasId: string) {
    const { data, error } = await this.sb.rpc('canvas_people', { cid: canvasId });
    if (error) fail(error);
    return (data || []) as Person[];
  }
  async links(canvasId: string) {
    const { data, error } = await this.sb.from('canvas_links').select('token,role').eq('canvas_id', canvasId);
    if (error) fail(error);
    return (data || []) as ShareLink[];
  }
  async createLink(canvasId: string, role: 'editor' | 'viewer', token: string) {
    const { error } = await this.sb.from('canvas_links').insert({ token, canvas_id: canvasId, role });
    if (error) fail(error);
  }
  async deleteLink(canvasId: string, role: 'editor' | 'viewer') {
    const { error } = await this.sb.from('canvas_links').delete().eq('canvas_id', canvasId).eq('role', role);
    if (error) fail(error);
  }
  async setRole(canvasId: string, userId: string, role: 'editor' | 'viewer') {
    const { error } = await this.sb.from('canvas_members').update({ role }).eq('canvas_id', canvasId).eq('user_id', userId);
    if (error) fail(error);
  }
  async removeMember(canvasId: string, userId: string) {
    const { error } = await this.sb.from('canvas_members').delete().eq('canvas_id', canvasId).eq('user_id', userId);
    if (error) fail(error);
  }
  async join(token: string) {
    const { data, error } = await this.sb.rpc('join_canvas', { p_token: token });
    if (error) fail(error);
    const row = ((data || []) as { canvas_id: string; role: Role }[])[0];
    if (!row) throw new CloudError('This share link has been turned off');
    return { canvasId: row.canvas_id, role: row.role };
  }
  openRoom(canvasId: string, me: PeerInfo, h: RoomHandlers): Room {
    const cfg = (presence: boolean) => ({ config: { private: true, broadcast: { self: false, ack: false }, ...(presence ? { presence: { key: me.uid } } : {}) } });
    const docCh = this.sb.channel(`fs:${canvasId}:doc`, cfg(false));
    const awCh = this.sb.channel(`fs:${canvasId}:aw`, cfg(true));
    let closed = false, docOk = false, awOk = false;
    docCh.on('broadcast', { event: 'm' }, ({ payload }) => h.doc(payload));
    awCh.on('broadcast', { event: 'm' }, ({ payload }) => h.aw(payload));
    awCh.on('presence', { event: 'sync' }, () => {
      const st = awCh.presenceState() as Record<string, any[]>;
      h.presence(Object.values(st).map(a => a[0]).filter(Boolean).map(p => ({ uid: p.uid, email: p.email, color: p.color, role: p.role })));
    });
    const report = () => { if (!closed) h.status(docOk && awOk ? 'joined' : 'error'); };
    const watch = (which: 'doc' | 'aw') => (status: string) => {
      const ok = status === 'SUBSCRIBED';
      if (which === 'doc') docOk = ok; else awOk = ok;
      if (ok && which === 'aw') awCh.track(me);
      if (ok ? docOk && awOk : status !== 'CLOSED') report();
    };
    (async () => {
      try { await this.sb.realtime.setAuth(); } catch { /* falls back to the session token */ }
      if (closed) return;
      docCh.subscribe(watch('doc'));
      awCh.subscribe(watch('aw'));
    })();
    return {
      sendDoc: msg => { if (!closed) docCh.send({ type: 'broadcast', event: 'm', payload: msg }); },
      sendAw: msg => { if (!closed) awCh.send({ type: 'broadcast', event: 'm', payload: msg }); },
      close: () => { closed = true; this.sb.removeChannel(docCh); this.sb.removeChannel(awCh); h.status('closed'); },
    };
  }
  async thumbUrls(paths: string[]) {
    const out: Record<string, string> = {};
    if (!paths.length) return out;
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    if (error) fail(error);
    for (const r of data || []) if (r.signedUrl && r.path) out[r.path] = r.signedUrl;
    return out;
  }
}
