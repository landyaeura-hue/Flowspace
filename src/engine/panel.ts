import type { ArrowMode, EdgeStyle, PenStyle } from './types';
// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { FS_PRESETS, INK, SHAPE_NAMES } from './constants';
import { THEMES } from './themes';
import { $ } from './dom';
import { openEditor, placeEditor } from './editing';
import { toast } from './help';
import { PEN_STYLES, inkAbs } from './ink';
import { physAfter, physOn } from './physics';
import { render } from './render';
import { arrange, copyStyle, del, groupSel, mutate, pasteStyle, reorder, selObjs, startBrush, ungroupSel } from './selection';
import { find, isEdge, isInk, isNode, isText, savePrefs, snap } from './state-init';
import { commit, scheduleSave } from './storage';
import { defFs, fitNode } from './text';
import { FILL_NAMES, isAutoInk, tc } from './theme';
import { MSG } from './strings';

// ---------- property panel ----------
export const SHAPE_ICONS = { rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>', roundrect: '<rect x="4" y="6" width="16" height="12" rx="4"/>', circle: '<circle cx="12" cy="12" r="7.5"/>', diamond: '<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"/>', capsule: '<rect x="3" y="8" width="18" height="8" rx="4"/>' };
export const AL = { left: '<path d="M5 7h14M5 12h9M5 17h12"/>', center: '<path d="M5 7h14M7.5 12h9M6 17h12"/>', right: '<path d="M5 7h14M10 12h9M7 17h12"/>' };
export const VAL = { top: '<path d="M5 5h14M12 9v10M8.5 12.5L12 9l3.5 3.5"/>', middle: '<path d="M5 12h14M12 4v5M12 15v5M9 6.5L12 9l3-2.5M9 17.5l3-2.5 3 2.5"/>', bottom: '<path d="M5 19h14M12 5v10M8.5 11.5L12 15l3.5-3.5"/>' };
export const same = (arr, k) => arr.length && arr.every(o => o[k] === arr[0][k]) ? arr[0][k] : undefined;
export const tgl = (act, on, label) => `<div class="tg ${on ? 'on' : ''}" data-act="${act}"><span>${label}</span><i></i></div>`;
export function textRows(objs) {
  const c = same(objs, 'color'), b = same(objs, 'bold'), al = same(objs, 'align'), fsv = same(objs.map(o => ({ v: defFs(o) })), 'v');
  const cn = c === undefined ? undefined : (isAutoInk(c) ? 'auto' : c), TC = ['auto', ...STATE.C.tcs];
  return `<div class="row"><div class="lab">Font size<span>${fsv ? fsv + ' px' : 'Mixed'}</span></div><div class="seg fs">${FS_PRESETS.map(v => `<button data-act="fs" data-v="${v}" class="${fsv === v ? 'on' : ''}">${v}</button>`).join('')}</div>
  <label class="num" style="margin-top:8px"><span>Custom</span><input type="number" data-act="fsc" min="8" max="200" value="${fsv ?? ''}" placeholder="8 – 200"></label></div>
  <div class="row"><div class="lab">Text color</div><div class="sws">${TC.map(x => `<button class="sw c ${cn === x ? 'on' : ''}" data-act="color" data-v="${x}" style="background:${x === 'auto' ? STATE.C.ink : x}" title="${x === 'auto' ? 'Auto (follows theme)' : x}"></button>`).join('')}<input type="color" data-act="colorc" value="${c && c[0] === '#' && c !== INK ? c : STATE.C.ink}" title="Custom color"></div></div>
  <div class="row"><div class="lab">Text</div><div class="seg"><button data-act="bold" class="${b ? 'on' : ''}" style="font-weight:700">B Bold</button>${Object.keys(AL).map(k => `<button data-act="align" data-v="${k}" class="${al === k ? 'on' : ''}" title="${{ left: 'Align left', center: 'Center', right: 'Align right' }[k]}"><svg viewBox="0 0 24 24">${AL[k]}</svg></button>`).join('')}</div></div>`;
}
export const AR_IC = { l: '<path d="M5 4v16M8 7h11v4H8zM8 13h7v4H8z"/>', ch: '<path d="M12 4v16M6 7h12v4H6zM8.5 13h7v4h-7z"/>', r: '<path d="M19 4v16M5 7h11v4H5zM9 13h7v4H9z"/>', t: '<path d="M4 5h16M7 8h4v11H7zM13 8h4v7h-4z"/>', cv: '<path d="M4 12h16M7 6h4v12H7zM13 8.5h4v7h-4z"/>', b: '<path d="M4 19h16M7 5h4v11H7zM13 9h4v7h-4z"/>', dh: '<path d="M4 5v14M20 5v14M8.5 8h2.5v8H8.5zM13 8h2.5v8H13z"/>', dv: '<path d="M5 4h14M5 20h14M8 8.5h8V11H8zM8 13h8v2.5H8z"/>' };
export const AR_T = { l: 'Align left  Alt A', ch: 'Center horizontally  Alt H', r: 'Align right  Alt D', t: 'Align top  Alt W', cv: 'Center vertically  Alt V', b: 'Align bottom  Alt S', dh: 'Distribute horizontally  Alt Shift H', dv: 'Distribute vertically  Alt Shift V' };
export function arrangeRow(objs) {
  const items = objs.filter(o => !isEdge(o)); if (items.length < 2) return items.some(o => o.g) ? `<div class="row"><button class="btn2" data-act="ungrp">Ungroup<small style="margin-left:6px;color:var(--ink2)">${STATE.MK} Shift G</small></button></div>` : '';
  const units = new Set(items.map(o => o.g || o.id)).size, allOneGroup = units === 1;
  return `<div class="row"><div class="lab">Arrange</div><div class="seg ar">${['l', 'ch', 'r', 't', 'cv', 'b'].map(k2 => `<button data-act="ar" data-v="${k2}" title="${AR_T[k2]}" ${units < 2 ? 'disabled' : ''}><svg viewBox="0 0 24 24">${AR_IC[k2]}</svg></button>`).join('')}</div>
  <div class="seg ar" style="margin-top:6px">${['dh', 'dv'].map(k2 => `<button data-act="ar" data-v="${k2}" title="${AR_T[k2]}" ${units < 3 ? 'disabled' : ''}><svg viewBox="0 0 24 24">${AR_IC[k2]}</svg></button>`).join('')}
  ${allOneGroup ? `<button data-act="ungrp" title="${STATE.MK} Shift G" style="flex:2">Ungroup</button>` : `<button data-act="grp" title="${STATE.MK} G" style="flex:2">Group</button>`}</div></div>`;
}
export const styleRow = () => `<div class="row"><div class="lab">Style</div><div class="seg"><button data-act="brush" title="Format painter: copy this style, then click a target">Painter</button><button data-act="stcopy" title="Copy style  ${STATE.MK} Alt C">Copy</button><button data-act="stpaste" title="Paste style  ${STATE.MK} Alt V" ${STATE.styleClip ? '' : 'disabled'}>Paste</button></div></div>`;
export const PEN_SIZES = [[2, 'Fine'], [4, 'Medium'], [8, 'Bold']];
export const inkColors = () => ['auto', ...STATE.C.tcs.filter(c => c !== '#FFFFFF'), STATE.C.selStrong, STATE.C.f.deep[1]].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);
export function penPanel() {
  return `<h4>Pen</h4><div class="row"><div class="lab">Color</div><div class="sws">${inkColors().map(x => `<button class="sw c ${STATE.penPref.color === x ? 'on' : ''}" data-act="pcolor" data-v="${x}" style="background:${x === 'auto' ? STATE.C.ink : x}" title="${x === 'auto' ? 'Auto (follows theme)' : x}"></button>`).join('')}<input type="color" data-act="pcolorc" value="${STATE.penPref.color[0] === '#' ? STATE.penPref.color : STATE.C.ink}"></div></div>
  <div class="row"><div class="lab">Nib</div><div class="seg">${PEN_STYLES.map(([v, t]) => `<button data-act="pstyle" data-v="${v}" class="${STATE.penPref.style === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <div class="row"><div class="lab">Thickness</div><div class="seg">${PEN_SIZES.map(([v, t]) => `<button data-act="psize" data-v="${v}" class="${STATE.penPref.sw === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <p class="note">Fountain: more pressure, thicker line, with a tapered tail on quick flicks. Calligraphy: angled nib — thin horizontals, bold verticals. With a mouse, speed sets the weight. Press and hold, then drag, to lasso.</p>
  <p class="note">Write directly with Apple Pencil; fingers pan and pinch-zoom. Strokes written in quick succession merge into one handwriting object. The Pencil’s eraser end erases.</p>`;
}
export function layerRow() { return `<div class="row"><div class="lab">Layer</div><div class="seg"><button data-act="z" data-v="top">Front</button><button data-act="z" data-v="up">Forward</button><button data-act="z" data-v="down">Backward</button><button data-act="z" data-v="bottom">Back</button></div></div>`; }
export function renderPanel() {
  const objs = selObjs();
  if (!objs.length) { if (STATE.tool === 'pen') { STATE.panel.classList.add('show'); STATE.panel.innerHTML = penPanel(); return; } STATE.panel.classList.remove('show'); return; }
  STATE.panel.classList.add('show');
  const nodes = objs.filter(isNode), texts = objs.filter(isText), edges = objs.filter(isEdge), inks = objs.filter(isInk);
  let h = '';
  if (inks.length && inks.length === objs.length) {
    const c = same(inks, 'color'), cn = c === undefined ? undefined : (isAutoInk(c) ? 'auto' : c);
    h = `<h4>${inks.length === 1 ? 'Handwriting' : `${inks.length} handwriting objects`}</h4>
    <div class="row"><div class="lab">Color</div><div class="sws">${inkColors().map(x => `<button class="sw c ${cn === x ? 'on' : ''}" data-act="color" data-v="${x}" style="background:${x === 'auto' ? STATE.C.ink : x}"></button>`).join('')}<input type="color" data-act="colorc" value="${c && c[0] === '#' ? c : STATE.C.ink}"></div></div>
    <div class="row"><div class="lab">Nib</div><div class="seg">${PEN_STYLES.map(([v, t]) => `<button data-act="istyle" data-v="${v}" class="${same(inks.map(o => ({ v: o.pen || 'ballpoint' })), 'v') === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    <div class="row"><div class="lab">Thickness</div><div class="seg">${PEN_SIZES.map(([v, t]) => `<button data-act="isize" data-v="${v}">${t}</button>`).join('')}</div></div>
    ${arrangeRow(objs)}${styleRow()}<div class="row">${tgl('lock', same(inks, 'locked') === true, 'Lock')}</div>${layerRow()}<button class="danger" data-act="del">Delete</button>`;
  } else if (edges.length && !nodes.length && !texts.length && !inks.length) {
    const es = same(edges.map(x => ({ v: x.style || 'orth' })), 'v'), ea = same(edges.map(x => ({ v: x.arrow || 'end' })), 'v');
    const ST = [['orth', 'Elbow', '<path d="M4 18h7V6h9"/>'], ['straight', 'Straight', '<path d="M4 19L20 5"/>'], ['curve', 'Curved', '<path d="M4 18C13 18 11 6 20 6"/>']];
    const AR = [['end', 'One-way', '<path d="M4 12h15M15 8l4 4-4 4"/>'], ['both', 'Two-way', '<path d="M5 12h14M9 8l-4 4 4 4M15 8l4 4-4 4"/>'], ['none', 'No arrow', '<path d="M4 12h16"/>']];
    h = `<h4>${edges.length > 1 ? `${edges.length} connectors` : 'Connector'}</h4>
    <div class="row"><div class="lab">Line</div><div class="seg">${ST.map(([k2, t, ic]) => `<button data-act="estyle" data-v="${k2}" class="${es === k2 ? 'on' : ''}" title="${t}"><svg viewBox="0 0 24 24">${ic}</svg></button>`).join('')}</div></div>
    <div class="row"><div class="lab">Arrow</div><div class="seg">${AR.map(([k2, t, ic]) => `<button data-act="earrow" data-v="${k2}" class="${ea === k2 ? 'on' : ''}" title="${t}"><svg viewBox="0 0 24 24">${ic}</svg></button>`).join('')}</div></div>
    <div class="row"><div class="lab">Label</div>${edges.length === 1 ? `<button class="btn2" data-act="elabel">${edges[0].label ? 'Edit label' : 'Add label'}</button>` : ''}<p class="note" style="margin:0">Or double-click the connector to type, e.g. “Yes” / “No”.</p></div>
    <p class="note" style="margin:-6px 0 12px">Drag the dots at either end to reconnect to another node.</p>${styleRow()}
    <button class="btn2" data-act="reverse">Reverse direction</button><button class="danger" data-act="del">Delete</button>`;
  } else if (nodes.length && !texts.length && !inks.length) {
    const one = nodes.length === 1 ? nodes[0] : null, sh = same(nodes, 'shape'), fill = same(nodes, 'fill');
    h = `<h4>${one ? SHAPE_NAMES[one.shape] : `${nodes.length} shapes`}</h4>
    ${arrangeRow(objs)}
    <div class="row"><div class="lab">Shape</div><div class="seg">${Object.keys(SHAPE_ICONS).map(k => `<button data-act="shape" data-v="${k}" class="${sh === k ? 'on' : ''}" title="${SHAPE_NAMES[k]}"><svg viewBox="0 0 24 24">${SHAPE_ICONS[k]}</svg></button>`).join('')}</div></div>
    <div class="row"><div class="lab">Fill</div><div class="sws">
      ${((THEMES[STATE.doc.theme] || THEMES.mist).order).map(k2 => `<button class="sw ${fill === k2 ? 'on' : ''}" data-act="fill" data-v="${k2}" style="background:linear-gradient(135deg,${STATE.C.f[k2][0]},${STATE.C.f[k2][1]})" title="${FILL_NAMES[k2]} (follows theme)"></button>`).join('')}
      <input type="color" data-act="fillc" value="${fill && fill[0] === '#' ? fill : '#E8EEFF'}" title="Custom fill"></div></div>
    <div class="row">${tgl('border', same(nodes, 'border') !== false, 'Border')}${tgl('shadow', same(nodes, 'shadow') !== false, 'Shadow')}</div>
    ${one ? `<div class="row"><div class="lab">Size</div><div class="nums"><label class="num"><span>W</span><input type="number" data-act="w" value="${one.w}" min="36"></label><label class="num"><span>H</span><input type="number" data-act="h" value="${one.h}" min="28"></label></div></div>` : ''}
    <div class="row">${tgl('fit', same(nodes, 'fit') === true, 'Grow height to fit text')}</div>
    ${nodes.some(n => n.shape === 'roundrect' || n.shape === 'diamond' || n.shape === 'rect') ? `<div class="row"><div class="lab">Corner radius<span id="rv">${same(nodes, 'radius') ?? ''}</span></div><input type="range" min="0" max="48" data-act="radius" value="${same(nodes, 'radius') ?? 24}"></div>` : ''}
    ${textRows(nodes)}
    <div class="row"><div class="lab">Vertical align</div><div class="seg">${Object.keys(VAL).map(k => `<button data-act="valign" data-v="${k}" class="${same(nodes, 'valign') === k ? 'on' : ''}" title="${{ top: 'Top', middle: 'Middle', bottom: 'Bottom' }[k]}"><svg viewBox="0 0 24 24">${VAL[k]}</svg></button>`).join('')}</div></div>
    ${styleRow()}<div class="row">${tgl('lock', same(nodes, 'locked') === true, 'Lock')}</div>
    ${layerRow()}<button class="danger" data-act="del">Delete</button>`;
  } else if (texts.length && !nodes.length && !inks.length) {
    const one = texts.length === 1 ? texts[0] : null;
    h = `<h4>${one ? 'Text box' : `${texts.length} text boxes`}</h4>
    ${arrangeRow(objs)}
    <div class="row"><div class="lab">Font</div><div class="fixed">System sans (Segoe UI / SF Pro)</div></div>
    ${textRows(texts)}
    <div class="row">${tgl('avoid', same(texts, 'avoid') === true, 'Keep nodes off this text')}<p class="note">Works in elastic mode: nodes steer around this text box, and the box itself never gets pushed.</p></div>
    ${one ? `<div class="row"><div class="lab">Box width</div><label class="num"><span>W</span><input type="number" data-act="tw" value="${one.w}" min="40"></label></div>` : ''}
    ${styleRow()}<div class="row">${tgl('lock', same(texts, 'locked') === true, 'Lock')}</div>
    ${layerRow()}<button class="danger" data-act="del">Delete</button>`;
  } else {
    const tx = objs.filter(o => isNode(o) || isText(o));
    h = `<h4>${objs.length} objects</h4>${arrangeRow(objs)}${tx.length ? textRows(tx) : ''}${styleRow()}<div class="row">${tgl('lock', same(objs.filter(o => !isEdge(o)), 'locked') === true, 'Lock')}</div>${layerRow()}<button class="danger" data-act="del">Delete</button>`;
  }
  STATE.panel.innerHTML = h; syncRanges(STATE.panel);
}
export function syncRanges(root) { (root || document).querySelectorAll('input[type=range]').forEach(r => r.style.setProperty('--p', ((r.value - r.min) / ((r.max - r.min) || 1) * 100) + '%')); }
export function renderPanelNums() { const o = selObjs()[0]; if (!o) return; const w = STATE.panel.querySelector<HTMLInputElement>('[data-act=w],[data-act=tw]'), hh = STATE.panel.querySelector<HTMLInputElement>('[data-act=h]'); if (w) w.value = o.w; if (hh) hh.value = o.h; }
export function applyAll(fn, filter = o => !isEdge(o)) { for (const o of selObjs()) if (filter(o)) fn(o); }

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initPanel() {
  document.addEventListener('input', e => { if ((e.target as HTMLInputElement).type === 'range') syncRanges((e.target as HTMLInputElement).parentNode); });
  STATE.panel.addEventListener('click', e => {
    const b = (e.target as HTMLInputElement).closest<HTMLInputElement>('[data-act]'); if (!b || b.tagName === 'INPUT') return;
    const a = b.dataset.act, v = b.dataset.v;
    if (a === 'del') return del();
    if (a === 'z') return reorder(v);
    if (a === 'ar') return arrange(v);
    if (a === 'grp') return groupSel();
    if (a === 'ungrp') return ungroupSel();
    if (a === 'brush') return startBrush();
    if (a === 'stcopy') { if (copyStyle()) { toast(MSG.styleCopied); renderPanel(); } return; }
    if (a === 'stpaste') return pasteStyle();
    if (a === 'pcolor') { STATE.penPref.color = v; savePrefs(); renderPanel(); return; }
    if (a === 'psize') { STATE.penPref.sw = +v; savePrefs(); renderPanel(); return; }
    if (a === 'pstyle') { STATE.penPref.style = v as PenStyle; savePrefs(); renderPanel(); return; }
    if (a === 'istyle') return mutate(() => applyAll(o => { o.pen = v; }, isInk));
    if (a === 'isize') return mutate(() => applyAll(o => { o.sw = +v / (inkAbs(o).s || 1); }, isInk));
    if (a === 'reverse') return mutate(() => applyAll(x => { [x.from, x.to] = [x.to, x.from]; }, isEdge));
    if (a === 'elabel') { const ee = selObjs().find(isEdge); if (ee) openEditor(ee.id); return; }
    if (a === 'estyle' || a === 'earrow') { mutate(() => applyAll(x => { if (a === 'estyle') x.style = v; else x.arrow = v; }, isEdge)); if (a === 'estyle') STATE.doc.edgeDef.style = v as EdgeStyle; else STATE.doc.edgeDef.arrow = v as ArrowMode; scheduleSave(); return; }
    mutate(() => {
      if (a === 'shape') applyAll(o => { o.shape = v; if (v === 'circle') { const s = Math.max(o.w, o.h); o.w = o.h = Math.min(s, Math.max(o.w, o.h)); } }, isNode);
      if (a === 'fill') applyAll(o => o.fill = v, isNode);
      if (a === 'border') { const on = !b.classList.contains('on'); applyAll(o => o.border = on, isNode); }
      if (a === 'shadow') { const on = !b.classList.contains('on'); applyAll(o => o.shadow = on, isNode); }
      if (a === 'color') applyAll(o => o.color = v);
      if (a === 'bold') { const on = !b.classList.contains('on'); applyAll(o => o.bold = on); }
      if (a === 'align') applyAll(o => o.align = v);
      if (a === 'valign') applyAll(o => o.valign = v, isNode);
      if (a === 'lock') { const on = !b.classList.contains('on'); applyAll(o => o.locked = on); }
      if (a === 'avoid') { const on = !b.classList.contains('on'); applyAll(o => o.avoid = on, isText); }
      if (a === 'fs') applyAll(o => o.fs = +v);
      if (a === 'fit') { const on = !b.classList.contains('on'); applyAll(o => o.fit = on, isNode); }
      applyAll(o => fitNode(o), isNode);
    });
    if (a === 'avoid') { physAfter([]); if (!physOn() && selObjs().some(o => o.avoid)) toast(MSG.turnOnElasticModeTo); }
    if (STATE.editing) { const it = find(STATE.editing); if (it && !isEdge(it)) Object.assign(STATE.ed.style, { color: tc(it), fontWeight: it.bold ? 700 : 400, textAlign: it.align, fontSize: defFs(it) + 'px' }); placeEditor(); STATE.ed.focus(); }
  });
  STATE.panel.addEventListener('input', e => {
    const i = e.target as HTMLInputElement, a = i.dataset.act; if (!a) return;
    if (!STATE.livePre) STATE.livePre = snap();
    if (a === 'radius') { applyAll(o => o.radius = +i.value, isNode); const rv = $('#rv'); if (rv) rv.textContent = i.value; }
    if (a === 'fillc') applyAll(o => o.fill = i.value, isNode);
    if (a === 'colorc') applyAll(o => o.color = i.value);
    if (a === 'pcolorc') { STATE.penPref.color = i.value; savePrefs(); STATE.livePre = null; return; }
    render();
  });
  STATE.panel.addEventListener('change', e => {
    const i = e.target as HTMLInputElement, a = i.dataset.act; if (!a || a === 'pcolorc') return;
    const pre = STATE.livePre || snap(); STATE.livePre = null;
    const n = Math.round(+i.value);
    if (a === 'w' && n >= 36) applyAll(o => o.w = n, isNode);
    if (a === 'h' && n >= 28) applyAll(o => o.h = n, isNode);
    if (a === 'tw' && n >= 40) applyAll(o => o.w = n, isText);
    if (a === 'fsc' && n >= 8 && n <= 200) applyAll(o => o.fs = n);
    if (a === 'w' || a === 'fsc') applyAll(o => fitNode(o), isNode);
    commit(pre);
    if (a === 'w' || a === 'h') physAfter(selObjs().filter(isNode).map(o => o.id));
  });
  STATE.panel.addEventListener('pointerdown', e => e.stopPropagation());
}
