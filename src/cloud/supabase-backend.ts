import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { CloudError, isNetworkError, type AuthEvent, type CanvasFull, type CanvasRow, type CanvasWrite, type CloudBackend, type CloudUser } from './backend';

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

  async list(): Promise<CanvasRow[]> {
    const { data, error } = await this.sb.from('canvases').select(LIST_COLS).order('updated_at', { ascending: false });
    if (error) fail(error);
    return (data || []) as CanvasRow[];
  }
  async get(id: string): Promise<CanvasFull | null> {
    const { data, error } = await this.sb.from('canvases').select(LIST_COLS + ',doc,view').eq('id', id).maybeSingle();
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
  async thumbUrls(paths: string[]) {
    const out: Record<string, string> = {};
    if (!paths.length) return out;
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    if (error) fail(error);
    for (const r of data || []) if (r.signedUrl && r.path) out[r.path] = r.signedUrl;
    return out;
  }
}
