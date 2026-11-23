// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import type { Edge, InkItem, NodeItem, TextItem } from './types';
import { NODE_FS } from './constants';

export const uid = p => p + Math.random().toString(36).slice(2, 9);
export const touches = new Map();
export const savePrefs = () => { try { localStorage.setItem('flowspace.pen', JSON.stringify(STATE.penPref)); localStorage.setItem('flowspace.xopts', JSON.stringify(STATE.xopts)); } catch (e: any) { } };
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const find = (id: string): any => STATE.doc.items.find(i => i.id === id) || STATE.doc.edges.find(e => e.id === id);
export const isNode = (o: any): o is NodeItem => o && o.type === 'node';
export const isText = (o: any): o is TextItem => o && o.type === 'text';
export const isEdge = (o: any): o is Edge => o && o.from !== undefined;
export const isInk = (o: any): o is InkItem => o && o.type === 'ink';
export const snap = () => JSON.stringify({ items: STATE.doc.items, edges: STATE.doc.edges });
export function sample() {
  const items = [
    { id: 'n_in', type: 'node', shape: 'capsule', x: 150, y: 330, w: 210, h: 74, fill: 'white', text: 'Input' },
    { id: 'n_ex', type: 'node', shape: 'roundrect', x: 590, y: 392, w: 400, h: 180, fill: 'blue', text: 'Execution', fs: NODE_FS },
    { id: 'n_core', type: 'node', shape: 'roundrect', x: 440, y: 250, w: 400, h: 190, fill: 'white', text: 'Core process' },
    { id: 'n_out', type: 'node', shape: 'capsule', x: 1010, y: 240, w: 200, h: 68, fill: 'blue', text: 'Output' },
    { id: 't_1', type: 'text', x: 450, y: 118, w: 360, text: 'Type anything here' }
  ].map(normalize);
  return { name: 'Untitled canvas', bg: 'blue', edgeDef: { style: 'orth', arrow: 'end' }, phys: { on: false, strength: 50, gap: 24 }, items, edges: [{ id: 'e1', from: 'n_in', to: 'n_ex' }, { id: 'e2', from: 'n_ex', to: 'n_out' }] };
}
export function normalize(it) {
  if (it.type === 'ink') return Object.assign({ color: 'auto', sw: 4, locked: false, strokes: [] }, it, { ow: it.ow || it.w, oh: it.oh || it.h });
  if (it.type === 'node') return Object.assign({ shape: 'roundrect', fill: 'white', border: true, shadow: true, radius: 24, locked: false, text: '', color: 'auto', bold: false, align: 'center', valign: 'middle' }, it);
  return Object.assign({ color: 'auto', bold: false, align: 'left', locked: false, avoid: false, text: '' }, it);
}

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initStateInit() {
  STATE.doc = null;
  STATE.view = { x: 0, y: 0, k: 1 };
  STATE.sel = new Set();
  STATE.tool = 'select';
  STATE.drag = null;
  STATE.hoverId = null;
  STATE.editing = null;
  STATE.undoS = [];
  STATE.redoS = [];
  STATE.clip = null;
  STATE.pasteN = 0;
  STATE.spaceDown = false;
  STATE.livePre = null;
  STATE.dragPid = null;
  STATE.pinch = null;
  STATE.penSeen = false;
  STATE.lastInk = null;
  STATE.styleClip = null;
  STATE.painter = false;
  STATE.penPref = { color: 'auto', sw: 4, style: 'fountain' };
  STATE.xopts = { sel: false, transparent: false };
  try { Object.assign(STATE.penPref, JSON.parse(localStorage.getItem('flowspace.pen')) || {}); Object.assign(STATE.xopts, JSON.parse(localStorage.getItem('flowspace.xopts')) || {}); } catch (e: any) { }
}
