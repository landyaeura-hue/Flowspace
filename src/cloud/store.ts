// UI state for accounts and cloud saving (React reads it; the sync writes it).
import { create } from 'zustand';
import type { CloudUser, PeerInfo, Role } from './backend';

export type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict';
export type Dialog = null | 'signin' | 'signup' | 'magic' | 'reset' | 'newpw' | 'upload';

export interface CloudUI {
  enabled: boolean;
  /** first session check finished */
  ready: boolean;
  user: CloudUser | null;
  sync: SyncState;
  syncError: string;
  dialog: Dialog;
  /** local canvases that have not been uploaded to this account yet */
  uploadable: number;
  conflict: { id: string; name: string } | null;
  /** live session on the open canvas */
  live: 'off' | 'connecting' | 'live';
  liveRole: Role | null;
  /** people in the open canvas right now (including me) */
  peers: PeerInfo[];
  share: boolean;
  /** shown in the sign-in dialog when a share link is waiting */
  joinPending: boolean;
}

export const useCloud = create<CloudUI>(() => ({
  enabled: false, ready: false, user: null, sync: 'idle', syncError: '', dialog: null, uploadable: 0, conflict: null,
  live: 'off', liveRole: null, peers: [], share: false, joinPending: false,
}));
export const setCloud = (p: Partial<CloudUI>) => useCloud.setState(p);
export const openDialog = (dialog: Dialog) => useCloud.setState({ dialog });
