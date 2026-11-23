// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { FONT } from './constants';
import { closeMenus } from './chrome';
import { $ } from './dom';
import { closeEditor } from './editing';
import { toast } from './help';
import { inkSVG } from './ink';
import { edgeSVG } from './routing';
import { expandGroups } from './selection';
import { nodeSVG, textItemSVG } from './shapes';
import { find, isEdge, isInk, isNode, isText } from './state-init';
import { blankDoc, newCanvas, normDoc, thumbSVG, uniqueName } from './storage';
import { bbox } from './text';
import { buildDefs, canvasBg } from './theme';
import { MSG } from './strings';

// ---------- export / import ----------
export const dlP = Promise.resolve(null);
export async function saveFile(name, data, mime) {
  const dl = await dlP;
  if (dl) {
    try { await dl.save({ filename: name, data }); toast('Exported ' + name); }
    catch (err: any) { if (err && err.code === 'declined') return; toast('Export failed: ' + ((err && (err.message || err.code)) || 'unknown reason')); }
    return;
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function exportSVG() {
  if (!STATE.doc.items.length) { toast(MSG.theCanvasIsEmpty); return null; }
  const selItems = [...expandGroups(new Set(STATE.sel))].map(find).filter(o => o && !isEdge(o)), onlySel = STATE.xopts.sel && selItems.length;
  const items = onlySel ? STATE.doc.items.filter(i => selItems.includes(i)) : STATE.doc.items, ids = new Set(items.map(i => i.id));
  const edges = onlySel ? STATE.doc.edges.filter(e => ids.has(e.from) && ids.has(e.to)) : STATE.doc.edges;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const it of items) { const b = bbox(it); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  const P = 48; x0 -= P; y0 -= P; x1 += P; y1 += P;
  const W = Math.ceil(x1 - x0), H = Math.ceil(y1 - y0);
  const nodes = items.filter(isNode), texts = items.filter(isText), inks = items.filter(isInk);
  const bgr = STATE.xopts.transparent ? '' : `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="${canvasBg(STATE.doc)}"/>`;
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${x0} ${y0} ${W} ${H}" font-family="${FONT}"><defs>${buildDefs(STATE.C)}</defs>${bgr}${edges.map(e => edgeSVG(e, true)).join('')}${nodes.map(n => nodeSVG(n, true)).join('')}${inks.map(k => inkSVG(k, true)).join('')}${texts.map(t => textItemSVG(t, true)).join('')}</svg>`;
  return { s, W, H };
}
/** Small PNG of the whole open canvas for the cloud canvas list (null when empty or unsupported). */
export async function thumbnailPNG(maxW = 480, maxH = 300): Promise<Blob | null> {
  const its = STATE.doc.items; if (!its.length) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const it of its) { const b = bbox(it); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  const P = 32; x0 -= P; y0 -= P; x1 += P; y1 += P;
  // keep the list's 58:40 shape so thumbnails are not cropped awkwardly
  let W = x1 - x0, H = y1 - y0; const want = maxW / maxH;
  if (W / H > want) { const nh = W / want; y0 -= (nh - H) / 2; H = nh; } else { const nw = H * want; x0 -= (nw - W) / 2; W = nw; }
  const nodes = its.filter(isNode), texts = its.filter(isText), inks = its.filter(isInk);
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxW}" height="${maxH}" viewBox="${x0} ${y0} ${W} ${H}" font-family="${FONT}"><defs>${buildDefs(STATE.C)}</defs><rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="${canvasBg(STATE.doc)}"/>${STATE.doc.edges.map(e => edgeSVG(e, true)).join('')}${nodes.map(n => nodeSVG(n, true)).join('')}${inks.map(k => inkSVG(k, true)).join('')}${texts.map(t => textItemSVG(t, true)).join('')}</svg>`;
  try {
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); await img.decode();
    const c = document.createElement('canvas'); c.width = maxW; c.height = maxH;
    c.getContext('2d').drawImage(img, 0, 0, maxW, maxH);
    return await new Promise<Blob | null>(res => c.toBlob(b => res(b), 'image/png'));
  } catch (err: any) { return null; }
}
/** PNG of the schematic list thumbnail, for canvases that are not open (no full render available). */
export async function schematicPNG(doc): Promise<Blob | null> {
  const s = thumbSVG(doc).replace('<svg class="th"', '<svg xmlns="http://www.w3.org/2000/svg" width="464" height="320"');
  try {
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); await img.decode();
    const c = document.createElement('canvas'); c.width = 464; c.height = 320; c.getContext('2d').drawImage(img, 0, 0, 464, 320);
    return await new Promise<Blob | null>(res => c.toBlob(b => res(b), 'image/png'));
  } catch (err: any) { return null; }
}
export const fileBase = () => (STATE.doc.name || 'FlowSpace').replace(/[\\/:*?"<>|]/g, '_');
export async function doExport(kind) {
  closeMenus(); if (STATE.editing) closeEditor();
  if (kind === 'json') return saveFile(fileBase() + '.json', JSON.stringify({ app: 'FlowSpace', version: 1, doc: STATE.doc }, null, 2), 'application/json');
  if (kind === 'import') return $('#fileIn').click();
  if (kind === 'new') return newCanvas();
  const r = exportSVG(); if (!r) return;
  if (kind === 'svg') return saveFile(fileBase() + '.svg', r.s, 'image/svg+xml');
  try {
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.s);
    await img.decode();
    const c = document.createElement('canvas'), sc = 2; c.width = r.W * sc; c.height = r.H * sc;
    const ctx = c.getContext('2d'); ctx.scale(sc, sc); ctx.drawImage(img, 0, 0, r.W, r.H);
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if (!blob) throw new Error('png');
    await saveFile(fileBase() + '.png', blob, 'image/png');
  } catch (err: any) { toast(MSG.pngExportFailedTrySvg); }
}

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initExport() {
  document.querySelectorAll<HTMLInputElement>('.menu [data-m]').forEach(b => b.addEventListener('click', () => doExport(b.dataset.m)));
  $('#fileIn').addEventListener('change', async e => {
    const f = (e.target as HTMLInputElement).files[0]; (e.target as HTMLInputElement).value = ''; if (!f) return;
    try {
      const o = JSON.parse(await f.text()), d = o.doc || o;
      if (!Array.isArray(d.items)) throw 0;
      const nd = normDoc(Object.assign(blankDoc(), d)); if (!d.name) nd.name = f.name.replace(/\.json$/i, '');
      newCanvas(nd, `Imported as “${uniqueName(nd.name)}”`);
    } catch (err: any) { toast(MSG.thatFileIsnTA); }
  });
}
