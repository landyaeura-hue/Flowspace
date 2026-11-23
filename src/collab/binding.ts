// Mirrors the engine's plain canvas document into a Y.Doc and back.
// Layout: Y.Map 'meta' (name, bg, theme, edgeDef, phys), Y.Map 'items' and Y.Map 'edges'
// (id → Y.Map of fields, with '_z' holding the stacking order). Changes are diffed per field,
// so two people editing different properties of the same object both keep their change.
import * as Y from 'yjs';
import type { CanvasDoc } from '../engine/types';

export const META_KEYS = ['name', 'bg', 'theme', 'edgeDef', 'phys'] as const;
type Coll = 'items' | 'edges';

const enc = (v: unknown) => (v === undefined ? undefined : JSON.stringify(v));

export function toB64(u: Uint8Array): string {
  let s = ''; const C = 0x8000;
  for (let i = 0; i < u.length; i += C) s += String.fromCharCode.apply(null, u.subarray(i, i + C) as unknown as number[]);
  return btoa(s);
}
export function fromB64(b: string): Uint8Array {
  const s = atob(b), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

/** Plain document from a Y.Doc (not normalised). */
export function readDoc(ydoc: Y.Doc): CanvasDoc {
  const meta = ydoc.getMap('meta'), d: any = {};
  for (const k of META_KEYS) { const v = meta.get(k); if (v !== undefined) d[k] = v; }
  for (const c of ['items', 'edges'] as Coll[]) {
    const m = ydoc.getMap(c) as Y.Map<Y.Map<unknown>>, rows: { z: number; id: string; o: any }[] = [];
    m.forEach((ym, id) => {
      if (!(ym instanceof Y.Map)) return;
      const o: any = {}; let z = 0;
      ym.forEach((v, k) => { if (k === '_z') z = Number(v) || 0; else o[k] = v; });
      o.id = id; rows.push({ z, id, o });
    });
    rows.sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    d[c] = rows.map(r => r.o);
  }
  return d as CanvasDoc;
}

/** Remembers what was last written to / read from Y so local edits can be diffed cheaply. */
export class Binder {
  private last = {
    items: new Map<string, Map<string, string>>(), edges: new Map<string, Map<string, string>>(),
    order: { items: [] as string[], edges: [] as string[] }, meta: new Map<string, string>(),
  };
  constructor(public ydoc: Y.Doc) {}

  /** Record `doc` as the state already in Y (after loading or applying remote changes). */
  remember(doc: CanvasDoc) {
    for (const c of ['items', 'edges'] as Coll[]) {
      const L = this.last[c]; L.clear();
      for (const o of doc[c] as any[]) { const f = new Map<string, string>(); for (const k in o) if (k !== 'id') { const e = enc(o[k]); if (e !== undefined) f.set(k, e); } L.set(o.id, f); }
      this.last.order[c] = (doc[c] as any[]).map(o => o.id);
    }
    this.last.meta.clear();
    for (const k of META_KEYS) { const e = enc((doc as any)[k]); if (e !== undefined) this.last.meta.set(k, e); }
  }

  /** Write the differences between `doc` and what Y last had. Returns true if anything changed. */
  write(doc: CanvasDoc, origin: unknown): boolean {
    let changed = false;
    this.ydoc.transact(() => {
      const meta = this.ydoc.getMap('meta');
      for (const k of META_KEYS) {
        const e = enc((doc as any)[k]);
        if (e !== this.last.meta.get(k)) { changed = true; if (e === undefined) { meta.delete(k); this.last.meta.delete(k); } else { meta.set(k, JSON.parse(e)); this.last.meta.set(k, e); } }
      }
      for (const c of ['items', 'edges'] as Coll[]) {
        const ym = this.ydoc.getMap(c) as Y.Map<Y.Map<unknown>>, L = this.last[c], list = doc[c] as any[];
        const ids = list.map(o => o.id), prevOrder = this.last.order[c];
        const reorder = ids.length !== prevOrder.length || ids.some((id, i) => id !== prevOrder[i]);
        const seen = new Set<string>();
        list.forEach((o, i) => {
          seen.add(o.id);
          let row = ym.get(o.id), lf = L.get(o.id);
          if (!(row instanceof Y.Map)) { row = new Y.Map(); ym.set(o.id, row); lf = new Map(); L.set(o.id, lf); changed = true; row.set('_z', i); }
          else if (!lf) { lf = new Map(); L.set(o.id, lf); }
          else if (reorder && row.get('_z') !== i) { row.set('_z', i); changed = true; }
          for (const k in o) {
            if (k === 'id') continue;
            const e = enc(o[k]);
            if (e === undefined) continue;
            if (lf.get(k) !== e) { row.set(k, JSON.parse(e)); lf.set(k, e); changed = true; }
          }
          for (const k of [...lf.keys()]) if (!(k in o) || o[k] === undefined) { row.delete(k); lf.delete(k); changed = true; }
        });
        for (const id of [...L.keys()]) if (!seen.has(id)) { ym.delete(id); L.delete(id); changed = true; }
        // objects that exist in Y but were never seen locally and are not in the doc were deleted locally
        // only if we knew about them; unknown ones (just arrived remotely) are left alone
        this.last.order[c] = ids;
      }
    }, origin);
    return changed;
  }
}

/** Merge two encoded states and return the merged state and its document. */
export function mergeStates(a: string | null, b: string | null): { state: string; doc: CanvasDoc } {
  const yd = new Y.Doc();
  if (a) Y.applyUpdate(yd, fromB64(a));
  if (b) Y.applyUpdate(yd, fromB64(b));
  return { state: toB64(Y.encodeStateAsUpdate(yd)), doc: readDoc(yd) };
}

/** Encoded state of a fresh Y.Doc built from a plain document (for canvases that never had one). */
export function stateFromDoc(doc: CanvasDoc): string {
  const yd = new Y.Doc(); new Binder(yd).write(doc, 'seed');
  return toB64(Y.encodeStateAsUpdate(yd));
}
