// What the cloud sync needs from a backend. SupabaseBackend is the real one;
// MemoryBackend (mock-backend.ts) is used for local tests when VITE_CLOUD_MOCK=1.
import type { CanvasDoc, View } from '../engine/types';

export interface CloudUser { id: string; email: string }

export type Role = 'owner' | 'editor' | 'viewer';

export interface CanvasRow {
  id: string;
  /** the signed-in user's role on this canvas */
  role?: Role;
  name: string;
  updated_at: string;
  node_count: number;
  thumb_path: string | null;
  version: number;
}
export interface CanvasFull extends CanvasRow { doc: CanvasDoc; view: View | null; ydoc?: string | null }
export interface CanvasWrite { name: string; doc: CanvasDoc; view: View | null; node_count: number; ydoc?: string }

export interface Person { user_id: string; email: string; role: Role }
export interface ShareLink { token: string; role: 'editor' | 'viewer' }

/** Someone in a live session. */
export interface PeerInfo { uid: string; email: string; color: string; role: Role }
export interface RoomHandlers {
  /** messages on the document channel (from editors) */
  doc(msg: any): void;
  /** cursors and sync requests (from everyone) */
  aw(msg: any): void;
  presence(peers: PeerInfo[]): void;
  status(s: 'joined' | 'error' | 'closed'): void;
}
export interface Room { sendDoc(msg: any): void; sendAw(msg: any): void; close(): void }

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'OTHER';

/** kind 'network' = could not reach the server (offline); the sync retries those quietly. */
export class CloudError extends Error {
  constructor(message: string, public kind: 'network' | 'auth' | 'exists' | 'other' = 'other') { super(message); }
}

export interface CloudBackend {
  readonly name: string;
  getUser(): Promise<CloudUser | null>;
  onAuth(cb: (event: AuthEvent, user: CloudUser | null) => void): void;
  signIn(email: string, password: string): Promise<void>;
  /** 'confirm' = account created, the user must click the link in the confirmation email */
  signUp(email: string, password: string): Promise<'confirm' | 'signed-in'>;
  sendMagicLink(email: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;

  list(): Promise<CanvasRow[]>;
  get(id: string): Promise<CanvasFull | null>;
  /** returns the new version; throws CloudError('exists') if the id is taken */
  insert(id: string, w: CanvasWrite): Promise<number>;
  /** saves only if the server still has `version`; returns the new version, or null if it changed or is gone */
  update(id: string, w: CanvasWrite, version: number): Promise<number | null>;
  remove(id: string): Promise<void>;
  /** uploads the thumbnail and records its path on the canvas row */
  putThumb(userId: string, id: string, png: Blob): Promise<string>;
  thumbUrls(paths: string[]): Promise<Record<string, string>>;

  // ---- sharing (stage 3) ----
  people(canvasId: string): Promise<Person[]>;
  links(canvasId: string): Promise<ShareLink[]>;
  createLink(canvasId: string, role: 'editor' | 'viewer', token: string): Promise<void>;
  deleteLink(canvasId: string, role: 'editor' | 'viewer'): Promise<void>;
  setRole(canvasId: string, userId: string, role: 'editor' | 'viewer'): Promise<void>;
  removeMember(canvasId: string, userId: string): Promise<void>;
  /** open a share link; returns the canvas and the role it grants */
  join(token: string): Promise<{ canvasId: string; role: Role }>;
  openRoom(canvasId: string, me: PeerInfo, h: RoomHandlers): Room;
}

export function isNetworkError(e: unknown): boolean {
  if (e instanceof CloudError) return e.kind === 'network';
  const m = String((e as any)?.message || e);
  return /Failed to fetch|NetworkError|Load failed|network|fetch failed|ERR_/i.test(m) || (typeof navigator !== 'undefined' && navigator.onLine === false);
}
