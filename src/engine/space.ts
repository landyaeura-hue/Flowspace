// Where canvases live. The engine always reads and writes a synchronous localStorage "space";
// a space may be mirrored somewhere else (the cloud sync in src/cloud) through these hooks.
// The default local space keeps the preview's original keys ('flowspace.index', 'flowspace.doc.<id>').
import { uid } from './state-init';

export interface FileEntryMeta {
  /** node count when the canvas is not cached on this device */
  nodes?: number;
  /** thumbnail image when the canvas is not cached on this device */
  thumbUrl?: string;
}

export interface SpaceHooks {
  kind: 'local' | 'cloud';
  /** key prefix in localStorage */
  ns: string;
  /** subtitle of the "My canvases" menu */
  label: string;
  newId(): string;
  /** status text after a successful local write */
  savedText: string;
  /** a canvas was written locally (only called when its document actually changed) */
  saved?(id: string): void;
  created?(id: string): void;
  deleted?(id: string): void;
  /** fetch a canvas that is listed but not cached on this device */
  fetchDoc?(id: string): Promise<boolean>;
  entryMeta?(id: string): FileEntryMeta | undefined;
  /** extra rows at the bottom of the "My canvases" menu */
  filesExtra?(): string;
  /** click inside the menu on an element with data-x; return true if handled */
  filesClick?(el: HTMLElement): boolean;
}

export const LOCAL_SPACE: SpaceHooks = {
  kind: 'local',
  ns: 'flowspace.',
  label: 'stored in this browser',
  newId: () => uid('c'),
  savedText: 'Saved locally',
};

export let SPACE: SpaceHooks = LOCAL_SPACE;
export function setSpaceHooks(s: SpaceHooks) { SPACE = s; }
