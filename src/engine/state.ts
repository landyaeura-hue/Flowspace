// Shared mutable editor state. Every former top-level `let` of the preview lives here.
// Initial values are assigned by each module's init function (see index.ts).
import type { Palette } from './themes';
import type { CanvasDoc, CanvasIndex, PenStyle, View } from './types';

export type Tool = 'select' | 'hand' | 'rect' | 'roundrect' | 'circle' | 'diamond' | 'capsule' | 'conn' | 'text' | 'pen' | 'lasso';

export interface EngineState {
  /** dom: $('#app') */
  app: HTMLDivElement;
  /** dom: $('#cv') */
  svg: SVGSVGElement;
  /** dom: $('#world') */
  world: SVGGElement;
  /** dom: $('#edges') */
  gE: SVGGElement;
  /** dom: $('#nodes') */
  gN: SVGGElement;
  /** dom: $('#texts') */
  gT: SVGGElement;
  /** dom: $('#ui') */
  gUI: SVGGElement;
  /** dom: $('#ghosts') */
  gG: SVGGElement;
  /** dom: $('#inks') */
  gK: SVGGElement;
  /** dom: [] */
  ghosts: { html: string; t0: number }[];
  /** dom: new Set() */
  prevSel: Set<string>;
  /** dom: $('#edwrap') */
  edwrap: HTMLDivElement;
  /** dom: $('#ed') */
  ed: HTMLDivElement;
  /** dom: $('#panel') */
  panel: HTMLDivElement;
  /** theme: THEMES.mist.light */
  C: Palette;
  /** state-init: null */
  doc: CanvasDoc;
  /** state-init: { x: 0, y: 0, k: 1 } */
  view: View;
  /** state-init: new Set() */
  sel: Set<string>;
  /** state-init: 'select' */
  tool: Tool;
  /** state-init: null */
  drag: any;
  /** state-init: null */
  hoverId: string | null;
  /** state-init: null */
  editing: string | null;
  /** state-init: [] */
  undoS: string[];
  /** state-init: [] */
  redoS: string[];
  /** state-init: null */
  clip: string | null;
  /** state-init: 0 */
  pasteN: number;
  /** state-init: false */
  spaceDown: boolean;
  /** state-init: null */
  livePre: string | null;
  /** state-init: null */
  dragPid: any;
  /** state-init: null */
  pinch: any;
  /** state-init: false */
  penSeen: boolean;
  /** state-init: null */
  lastInk: any;
  /** state-init: null */
  styleClip: any;
  /** state-init: false */
  painter: boolean;
  /** state-init: { color: 'auto', sw: 4, style: 'fountain' } */
  penPref: { color: string; sw: number; style: PenStyle };
  /** state-init: { sel: false, transparent: false } */
  xopts: { sel: boolean; transparent: boolean };
  /** text: document.createElement('canvas').getContext('2d') */
  mctx: any;
  /** render: 0 */
  rafS: any;
  /** storage: 0 */
  saveT: number;
  /** storage: null */
  curId: string | null;
  /** storage: { current: null, list: [] } */
  index: CanvasIndex;
  /** storage: null */
  pendingDel: string | null;
  /** editing: null */
  editing_pre: any;
  /** editing: '' */
  editing_orig: any;
  /** editing: false */
  editing_new: any;
  /** pointer: null */
  lastDown: any;
  /** pointer: null */
  lp: any;
  /** pointer: 0 */
  ctxAt: number;
  /** pointer: 0 */
  viewAnim: any;
  /** pointer: null */
  gest: any;
  /** layout: false */
  layoutBusy: boolean;
  /** clipboard: true */
  cutDone: boolean;
  /** clipboard: true */
  pasteDone: boolean;
  /** help: isMac ? '⌘' : 'Ctrl' */
  MK: string;
  /** help: [['Select tool', 'V'], ['Hand tool', 'H'], ['Five shapes', ' */
  KEYS: [string, string][];
  /** help: 0 */
  toastT: number;
}

export const STATE = {} as EngineState;
