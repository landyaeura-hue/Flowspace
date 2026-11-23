// What the cloud sync needs from a backend. SupabaseBackend is the real one;
// MemoryBackend (mock-backend.ts) is used for local tests when VITE_CLOUD_MOCK=1.
import type { CanvasDoc, View } from '../engine/types';

export interface CloudUser { id: string; email: string }

export interface CanvasRow {
  id: string;
  name: string;
  updated_at: string;
  node_count: number;
  thumb_path: string | null;
  version: number;
}
export interface CanvasFull extends CanvasRow { doc: CanvasDoc; view: View | null }
export interface CanvasWrite { name: string; doc: CanvasDoc; view: View | null; node_count: number }

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
}

export function isNetworkError(e: unknown): boolean {
  if (e instanceof CloudError) return e.kind === 'network';
  const m = String((e as any)?.message || e);
  return /Failed to fetch|NetworkError|Load failed|network|fetch failed|ERR_/i.test(m) || (typeof navigator !== 'undefined' && navigator.onLine === false);
}
