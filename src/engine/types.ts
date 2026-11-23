// Canvas document model (what is saved locally today and will be stored in Yjs / Postgres later).
import type { FillKey, ThemeKey } from './themes';

export type Shape = 'rect' | 'roundrect' | 'circle' | 'diamond' | 'capsule';
export type Align = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';
export type PenStyle = 'fountain' | 'ballpoint' | 'brush';
export type EdgeStyle = 'orth' | 'straight' | 'curve';
export type ArrowMode = 'end' | 'both' | 'none';
/** 'auto' = pick a readable colour from the theme / fill */
export type Color = 'auto' | string;

interface ItemBase {
  id: string;
  x: number; y: number; w: number;
  locked: boolean;
  /** group id shared by grouped objects */
  g?: string;
}

export interface NodeItem extends ItemBase {
  type: 'node';
  h: number;
  shape: Shape;
  fill: FillKey | string;
  border: boolean; shadow: boolean; radius: number;
  text: string; color: Color; bold: boolean; fs?: number;
  align: Align; valign: VAlign;
  /** grow height to fit text */
  fit?: boolean;
}

export interface TextItem extends ItemBase {
  type: 'text';
  h?: number;
  text: string; color: Color; bold: boolean; fs?: number; align: Align;
  /** keep nodes off this text in elastic mode */
  avoid: boolean;
}

export interface InkPoint { x: number; y: number; p?: number }
export interface InkItem extends ItemBase {
  type: 'ink';
  h: number;
  /** original size, used for proportional scaling */
  ow: number; oh: number;
  color: Color; sw: number; pen?: PenStyle;
  strokes: InkPoint[][];
}

export type Item = NodeItem | TextItem | InkItem;

export interface Edge {
  id: string; from: string; to: string;
  style?: EdgeStyle; arrow?: ArrowMode; label?: string;
}

export interface CanvasDoc {
  name: string;
  bg: 'blue' | 'white' | 'dark';
  theme: ThemeKey;
  edgeDef: { style: EdgeStyle; arrow: ArrowMode };
  phys: { on: boolean; strength: number; gap: number };
  items: Item[];
  edges: Edge[];
}

export interface View { x: number; y: number; k: number }

/** localStorage layout: 'flowspace.index' -> CanvasIndex, 'flowspace.doc.<id>' -> { doc, view } */
export interface CanvasIndex { current: string | null; list: { id: string; name: string; updated: number }[] }
