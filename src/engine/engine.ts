// @ts-nocheck
// FlowSpace canvas engine, moved verbatim from the single-file preview ("FlowSpace Preview").
// Stage 1 keeps behaviour identical; it is being split into typed modules step by step
// (see docs/MIGRATION.md). Do not add new features here without splitting first.
import { THEMES } from './themes';
import { FONT, NODE_FS, TEXT_FS, LBL_FS, LH, INK, FS_PRESETS, FS_STEPS, DEF_SIZE, SHAPE_NAMES } from './constants';

let mounted = false;

/** Attach the engine to the shell rendered by <Shell/>. Safe to call twice (StrictMode). */
export function mountEngine(): void {
if (mounted) return;
mounted = true;
const $ = s => document.querySelector(s);
const app = $('#app'), svg = $('#cv'), world = $('#world');
const gE = $('#edges'), gN = $('#nodes'), gT = $('#texts'), gUI = $('#ui'), gG = $('#ghosts'), gK = $('#inks');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const now = () => performance.now();
const anims = new Map(); let ghosts = [], prevSel = new Set();
function anim(id, name, dur) { if (!RM) anims.set(id, { name, t0: now(), dur }); }
function animOf(id) {
  if (drag && drag.type === 'move' && drag.moved && drag.orig[id]) return { name: 'lift', t0: drag.liftT0 };
  if (drag && (drag.type === 'connect' || drag.type === 'reconnect') && drag.target === id) return { name: 'magnet', t0: drag.targetT0 };
  const a = anims.get(id); if (!a) return null;
  if (now() - a.t0 > a.dur) { anims.delete(id); return null; } return a;
}
const animAttr = (a, extra = '') => a ? ` class="an an-${a.name}${extra}" style="animation-delay:-${Math.round(now() - a.t0)}ms"` : (extra ? ` class="${extra.trim()}"` : '');
const edwrap = $('#edwrap'), ed = $('#ed'), panel = $('#panel');

let C = THEMES.mist.light;
function palOf(d) { const T = THEMES[d && d.theme] || THEMES.mist; return d && d.bg === 'dark' ? Object.assign({ dark: true }, T.dark) : T.light; }
function buildDefs(P) {
  const dk = !!P.dark, g = (id, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient>`;
  const f = (id, col, dy, sd, o1, h) => `<filter id="${id}" x="-30%" y="-40%" width="160%" height="${h}%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="${dy}" stdDeviation="${sd}" flood-color="${col}" flood-opacity="${o1}"/><feDropShadow dx="0" dy="${dy > 15 ? 3 : 1.5}" stdDeviation="${dy > 15 ? 3 : 1.5}" flood-color="${col}" flood-opacity="${dk ? .35 : .08}"/></filter>`;
  const mk = (id, c, sz) => `<marker id="${id}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="${sz}" markerHeight="${sz}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1.5 1.8L10.5 6 1.5 10.2Q3.2 6 1.5 1.8z" fill="${c}" stroke="${c}" stroke-width="1" stroke-linejoin="round"/></marker>`;
  return Object.keys(GID).map(k => P.f[k] ? g(GID[k], P.f[k]) : '').join('') +
    f('shW', P.sh, 12, 14, dk ? .5 : .13, 200) + f('shWL', P.sh, 20, 20, dk ? .65 : .2, 220) + f('shB', P.shB, 12, 14, dk ? .55 : .2, 200) + f('shBL', P.shB, 20, 20, dk ? .7 : .28, 220) +
    mk('ar', P.line, 12) + mk('arS', P.selStrong, 14);
}
const GID = { white: 'gW', soft: 'gS', blue: 'gB', accent: 'gA', strong: 'gT', deep: 'gD' };
const FILL_NAMES = { white: 'White', soft: 'Tint', blue: 'Light', accent: 'Accent', strong: 'Mid', deep: 'Deep' };
function fillOf(k) {
  const f = C.f[k];
  if (f) return { f: `url(#${GID[k]})`, s: f[2], sh: k === 'white' || k === 'soft' ? 'shW' : 'shB' };
  return { f: k, s: C.dark ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.7)', sh: 'shB' };
}
const isAutoInk = c => !c || c === 'auto' || c === INK;
function lum(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null;
  let h = m[1]; if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const v = [0, 2, 4].map(i => { const c = parseInt(h.substr(i, 2), 16) / 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); });
  return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
}
const contrast = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
function autoInk(fillHex) {
  const L = lum(fillHex); if (L == null) return C.ink;
  const T = THEMES[doc.theme] || THEMES.mist, darkInk = T.light.ink, lightInk = C.dark ? C.ink : '#FFFFFF';
  return contrast(L, lum(darkInk)) >= contrast(L, lum(lightInk)) ? darkInk : lightInk;
}
const tc = o => !isAutoInk(o.color) ? o.color : isNode(o) ? autoInk(C.f[o.fill] ? C.f[o.fill][1] : o.fill) : C.ink;
const canvasBg = d => d.bg === 'white' ? '#FFFFFF' : palOf(d).cbg;
function applyTheme() {
  C = palOf(doc); const dk = !!C.dark, st = app.style;
  $('#defs').innerHTML = buildDefs(C);
  app.classList.toggle('dark', dk);
  const vars = { '--cbg': C.cbg, '--cbg2': C.cbg2, '--ink': C.ink, '--ink2': C.ink2, '--acc': C.acc, '--on': C.on, '--sel': C.sel, '--selSoft': C.selSoft, '--ring': C.ring, '--lineH': C.lineH, '--tip': dk ? C.ink : C.ink, '--pri': C.ink, '--priH': C.lineH, '--card': dk ? C.card : 'rgba(255,255,255,.92)', '--raised': dk ? C.raised : '#fff' };
  for (const k in vars) st.setProperty(k, vars[k]);
  const T = THEMES[doc.theme] || THEMES.mist;
  const b1 = document.querySelector('[data-bg=blue]'), b3 = document.querySelector('[data-bg=dark]');
  if (b1) b1.style.background = `linear-gradient(135deg,${T.light.cbg2},${T.light.f.blue[1]})`;
  if (b3) b3.style.background = `linear-gradient(135deg,${T.dark.cbg2},${T.dark.cbg})`;
  const lg = document.querySelector('.logo svg'); if (lg) lg.setAttribute('stroke', dk ? '#fff' : C.ink);
}
function setTheme(key) {
  if (!THEMES[key] || doc.theme === key) return;
  doc.theme = key; applyTheme(); draw(); renderPanel(); renderPhys(); renderThemes(); scheduleSave();
  if (!RM) { world.style.animation = 'none'; requestAnimationFrame(() => { world.style.animation = 'k-fade .35s ease-out'; }); }
  toast(`Theme: ${THEMES[key].name}`);
}
function themeThumb(T, dk) {
  const P = dk ? T.dark : T.light;
  return `<svg viewBox="0 0 64 42"><rect width="64" height="42" fill="${P.cbg}"/><path d="M22 15h7v13h6" fill="none" stroke="${P.line}" stroke-width="1.2"/><rect x="6" y="9" width="18" height="11" rx="4" fill="${P.f.white[0]}" stroke="${P.f.white[2]}" stroke-width=".6"/><rect x="33" y="22" width="24" height="12" rx="4" fill="${P.f.blue[1]}"/><rect x="38" y="7" width="20" height="9" rx="4.5" fill="${P.f.accent[1]}"/><rect x="9" y="13.6" width="9" height="1.8" rx=".9" fill="${P.ink}" opacity=".7"/></svg>`;
}
function renderThemes() {
  const dk = doc.bg === 'dark';
  $('#pTheme').innerHTML = `<h4>Color theme</h4><div class="thg">${Object.entries(THEMES).map(([k, T]) => `<button class="thc ${doc.theme === k ? 'on' : ''}" data-theme="${k}">${themeThumb(T, dk)}<div><b>${T.name}</b><span class="note" style="margin:0">${T.note}</span><div class="dots">${T.sw.slice(1).map(c => `<i style="background:${c}"></i>`).join('')}</div></div><span class="ck">✓</span></button>`).join('')}</div>
  <p class="note" style="margin-top:10px">Each canvas keeps its own theme. Nodes using theme fills recolor automatically; custom colors stay as they are.</p>`;
}
$('#pTheme').addEventListener('click', e => { const b = e.target.closest('[data-theme]'); if (b) setTheme(b.dataset.theme); });



// ---------- state ----------
let doc = null, view = { x: 0, y: 0, k: 1 };
let sel = new Set(), tool = 'select', drag = null, hoverId = null, editing = null;
let undoS = [], redoS = [], clip = null, pasteN = 0, spaceDown = false, livePre = null;
const uid = p => p + Math.random().toString(36).slice(2, 9);
let dragPid = null, pinch = null, penSeen = false, lastInk = null, styleClip = null, painter = false;
const touches = new Map();
let penPref = { color: 'auto', sw: 4, style: 'fountain' }, xopts = { sel: false, transparent: false };
try { Object.assign(penPref, JSON.parse(localStorage.getItem('flowspace.pen')) || {}); Object.assign(xopts, JSON.parse(localStorage.getItem('flowspace.xopts')) || {}); } catch (e) { }
const savePrefs = () => { try { localStorage.setItem('flowspace.pen', JSON.stringify(penPref)); localStorage.setItem('flowspace.xopts', JSON.stringify(xopts)); } catch (e) { } };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const find = id => doc.items.find(i => i.id === id) || doc.edges.find(e => e.id === id);
const isNode = o => o && o.type === 'node', isText = o => o && o.type === 'text', isEdge = o => o && o.from !== undefined, isInk = o => o && o.type === 'ink';
const snap = () => JSON.stringify({ items: doc.items, edges: doc.edges });

function sample() {
  const items = [
    { id: 'n_in', type: 'node', shape: 'capsule', x: 150, y: 330, w: 210, h: 74, fill: 'white', text: 'Input' },
    { id: 'n_ex', type: 'node', shape: 'roundrect', x: 590, y: 392, w: 400, h: 180, fill: 'blue', text: 'Execution', fs: NODE_FS },
    { id: 'n_core', type: 'node', shape: 'roundrect', x: 440, y: 250, w: 400, h: 190, fill: 'white', text: 'Core process' },
    { id: 'n_out', type: 'node', shape: 'capsule', x: 1010, y: 240, w: 200, h: 68, fill: 'blue', text: 'Output' },
    { id: 't_1', type: 'text', x: 450, y: 118, w: 360, text: 'Type anything here' }
  ].map(normalize);
  return { name: 'Untitled canvas', bg: 'blue', edgeDef: { style: 'orth', arrow: 'end' }, phys: { on: false, strength: 50, gap: 24 }, items, edges: [{ id: 'e1', from: 'n_in', to: 'n_ex' }, { id: 'e2', from: 'n_ex', to: 'n_out' }] };
}
function normalize(it) {
  if (it.type === 'ink') return Object.assign({ color: 'auto', sw: 4, locked: false, strokes: [] }, it, { ow: it.ow || it.w, oh: it.oh || it.h });
  if (it.type === 'node') return Object.assign({ shape: 'roundrect', fill: 'white', border: true, shadow: true, radius: 24, locked: false, text: '', color: 'auto', bold: false, align: 'center', valign: 'middle' }, it);
  return Object.assign({ color: 'auto', bold: false, align: 'left', locked: false, avoid: false, text: '' }, it);
}

// ---------- text measuring ----------
const mctx = document.createElement('canvas').getContext('2d');
function wrap(text, maxW, fs, bold) {
  mctx.font = `${bold ? 700 : 400} ${fs}px ${FONT}`;
  const W = s => mctx.measureText(s).width, out = [];
  for (const para of String(text).split('\n')) {
    const toks = para.match(/[A-Za-z0-9_\-.,!?;:'"()@#$%&*+=\/\\<>\[\]{}~`^|]+ *| +|[\s\S]/gu) || [];
    let line = '';
    for (const t of toks) {
      if (W((line + t).trimEnd()) <= maxW) { line += t; continue; }
      if (line) { out.push(line.trimEnd()); line = ''; }
      const tt = t.replace(/^ +/, '');
      if (W(tt.trimEnd()) <= maxW) { line = tt; continue; }
      for (const ch of tt) { if (W(line + ch) > maxW && line) { out.push(line); line = ch; } else line += ch; }
    }
    out.push(line.trimEnd());
  }
  return out;
}
function innerBox(n) {
  const { x, y, w, h } = n;
  if (n.shape === 'circle') return { x: x + w * .15, y: y + h * .15, w: w * .7, h: h * .7 };
  if (n.shape === 'diamond') return { x: x + w * .22, y: y + h * .22, w: w * .56, h: h * .56 };
  if (n.shape === 'capsule') { const p = Math.min(h * .4, w * .2); return { x: x + p, y: y + 8, w: w - 2 * p, h: h - 16 }; }
  return { x: x + 16, y: y + 12, w: w - 32, h: h - 24 };
}
const TPX = 8, TPY = 6;
const defFs = it => it.fs || (it.type === 'text' ? TEXT_FS : NODE_FS);
function textH(t) { const fs = defFs(t); return Math.max(1, wrap(t.text, t.w - 2 * TPX, fs, t.bold).length) * fs * LH + 2 * TPY; }
function fitNode(n) {
  if (!n || !n.fit || !isNode(n)) return;
  const fs = defFs(n), b = innerBox(n), need = Math.max(1, wrap(n.text || ' ', b.w, fs, n.bold).length) * fs * LH;
  const h = n.shape === 'circle' ? need / .7 + 12 : n.shape === 'diamond' ? need / .56 + 12 : n.shape === 'capsule' ? need + 28 : need + 36;
  n.h = Math.round(Math.max(44, h));
}
function bbox(it) { return it.type === 'text' ? { x: it.x, y: it.y, w: it.w, h: textH(it) } : { x: it.x, y: it.y, w: it.w, h: it.h }; }

function textSVG(lines, box, fs, color, bold, align, valign) {
  const lh = fs * LH, total = lines.length * lh;
  const top = valign === 'top' ? box.y : valign === 'bottom' ? box.y + box.h - total : box.y + (box.h - total) / 2;
  const x = align === 'left' ? box.x : align === 'right' ? box.x + box.w : box.x + box.w / 2;
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  return `<text font-size="${fs}" fill="${color}" font-weight="${bold ? 700 : 400}" text-anchor="${anchor}" style="pointer-events:none;white-space:pre">` +
    lines.map((l, i) => `<tspan x="${x}" y="${(top + i * lh + lh / 2 + fs * .36).toFixed(2)}">${esc(l) || ' '}</tspan>`).join('') + '</text>';
}

// ---------- shapes ----------
function roundPoly(pts, r) {
  const n = pts.length; let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a.x - p.x, a.y - p.y), lb = Math.hypot(b.x - p.x, b.y - p.y);
    const rr = Math.min(r, la / 2, lb / 2);
    const p1 = { x: p.x + (a.x - p.x) * rr / la, y: p.y + (a.y - p.y) * rr / la }, p2 = { x: p.x + (b.x - p.x) * rr / lb, y: p.y + (b.y - p.y) * rr / lb };
    d += `${i ? 'L' : 'M'}${p1.x.toFixed(2)},${p1.y.toFixed(2)}Q${p.x},${p.y} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d + 'Z';
}
function shapeEl(n, attrs) {
  const { x, y, w, h } = n;
  switch (n.shape) {
    case 'circle': return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${attrs}/>`;
    case 'diamond': return `<path d="${roundPoly([{ x: x + w / 2, y }, { x: x + w, y: y + h / 2 }, { x: x + w / 2, y: y + h }, { x, y: y + h / 2 }], n.radius * .55)}" ${attrs}/>`;
    case 'capsule': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" ${attrs}/>`;
    case 'rect': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(n.radius, 6, w / 2, h / 2) * (n.radius ? 1 : 0)}" ${attrs}/>`;
    default: return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(n.radius, w / 2, h / 2)}" ${attrs}/>`;
  }
}
function nodeSVG(n, exp) {
  const F = fillOf(n.fill);
  const an = exp ? null : animOf(n.id), lifted = an && an.name === 'lift';
  const a = `fill="${F.f}" stroke="${n.border ? F.s : 'none'}" stroke-width="1.2" ${n.shadow ? `filter="url(#${F.sh}${lifted ? 'L' : ''})"` : ''}`;
  let t = '';
  if (n.text && (exp || editing !== n.id)) { const b = innerBox(n), fs = defFs(n); t = textSVG(wrap(n.text, b.w, fs, n.bold), b, fs, tc(n), n.bold, n.align, n.valign); }
  return `<g ${exp ? '' : `data-id="${n.id}"`}${animAttr(an)}>${shapeEl(n, a)}${t}</g>`;
}
function textItemSVG(t, exp) {
  const h = textH(t);
  const hit = exp ? '' : `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${h}" fill="transparent"/>`;
  const fs = defFs(t), txt = (exp || editing !== t.id) && t.text ? textSVG(wrap(t.text, t.w - 2 * TPX, fs, t.bold), { x: t.x + TPX, y: t.y + TPY, w: t.w - 2 * TPX, h: h - 2 * TPY }, fs, tc(t), t.bold, t.align, 'top') : '';
  return `<g ${exp ? '' : `data-id="${t.id}"`}${exp ? '' : animAttr(animOf(t.id))}>${hit}${txt}</g>`;
}

// ---------- ink (pen strokes) ----------
const PEN_STYLES = [['fountain', 'Fountain'], ['ballpoint', 'Ballpoint'], ['brush', 'Calligraphy']];
function resample(P) {
  // Catmull-Rom through captured points, ~2px spacing
  if (P.length < 3) return P;
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const n = Math.max(1, Math.min(12, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2)));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const c = k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([c(0), c(1), p1[2] + ((p2[2] ?? .5) - (p1[2] ?? .5)) * t]);
    }
  }
  out.push(P[P.length - 1]); return out;
}
function strokeEls(P, sw, style) {
  if (!P.length) return '';
  style = style || 'ballpoint';
  const f = v => v.toFixed(2), pts = resample(P), n = pts.length;
  // how fast the stroke ended (spacing of the last raw samples) → flick = sharp tapered tail, slow stop = blunt end
  const k3 = P.slice(-4); let seg = 0; for (let i = 1; i < k3.length; i++) seg += Math.hypot(k3[i][0] - k3[i - 1][0], k3[i][1] - k3[i - 1][1]);
  const fast = Math.min(1, Math.max(0, (seg / Math.max(1, k3.length - 1) / Math.max(1, sw * .5) - .8) / 2.2)), tMin = .7 - .64 * fast;
  const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[n - 1], pr = i => Math.min(1, Math.max(0, pts[i][2] == null ? .5 : pts[i][2]));
  const NIB = -0.7;
  let R = pts.map((q, i) => {
    const p = pr(i);
    if (style === 'ballpoint') return sw / 2 * (.8 + .4 * p);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const tS = Math.min(1, cum[i] / Math.max(2, sw * (style === 'brush' ? 2 : 1.2)));
    const endLen = Math.max(sw * 3, Math.min(sw * 9, total * .28)), tE = Math.min(1, (total - cum[i]) / endLen);
    const endF = tMin + (1 - tMin) * Math.pow(tE, .55);
    if (style === 'brush') return sw / 2 * (.18 + 1.5 * Math.abs(Math.sin(ang - NIB))) * (.55 + .7 * p) * (.6 + .4 * Math.sqrt(tS)) * endF;
    return sw / 2 * (.18 + 1.55 * p) * (.7 + .3 * Math.sqrt(tS)) * endF;
  });
  R = R.map((r, i) => (R[Math.max(0, i - 1)] + 2 * r + R[Math.min(n - 1, i + 1)]) / 4);
  const cap = (q, r) => r > .05 ? `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(r)}"/>` : '';
  if (n === 1 || total < .5) return cap(pts[0], Math.max(R[0], sw * .45));
  const L = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    L.push([pts[i][0] - dy * R[i], pts[i][1] + dx * R[i]]); Rt.push([pts[i][0] + dy * R[i], pts[i][1] - dx * R[i]]);
  }
  const ring = L.concat(Rt.reverse()), m2 = ring.length, mid = (a, b) => `${f((a[0] + b[0]) / 2)},${f((a[1] + b[1]) / 2)}`;
  let d = `M${mid(ring[m2 - 1], ring[0])}`;
  for (let i = 0; i < m2; i++) d += `Q${f(ring[i][0])},${f(ring[i][1])} ${mid(ring[i], ring[(i + 1) % m2])}`;
  return `<path d="${d}Z"/>` + cap(pts[0], R[0]) + cap(pts[n - 1], R[n - 1]);
}
function inkAbs(it) {
  const sx = it.w / (it.ow || it.w || 1), sy = it.h / (it.oh || it.h || 1);
  return { s: Math.sqrt(sx * sy) || 1, strokes: it.strokes.map(st => st.map(([x, y, p]) => [it.x + x * sx, it.y + y * sy, p])) };
}
function inkSVG(it, exp) {
  const A = inkAbs(it), body = A.strokes.map(st => strokeEls(st, it.sw * A.s, it.pen)).join('');
  const hit = exp ? '' : `<g fill="none" stroke="transparent" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">${A.strokes.map(st => `<polyline points="${st.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}"/>`).join('')}</g>`;
  return `<g ${exp ? '' : `data-id="${it.id}"`}${exp ? '' : animAttr(animOf(it.id))}><g fill="${tc(it)}">${body}</g>${hit}</g>`;
}
function finishInk(d) {
  const pts = d.pts; if (!pts.length) return;
  const col = penPref.color, sw = penPref.sw, pad = sw * 1.2;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const last = lastInk && find(lastInk.id), near = 90 / view.k;
  let strokes = [pts];
  if (isInk(last) && now() - lastInk.t < 1800 && last.color === col && (last.pen || 'ballpoint') === penPref.style && Math.abs(last.sw * inkAbs(last).s - sw) < .5 &&
      x0 < last.x + last.w + near && x1 > last.x - near && y0 < last.y + last.h + near && y1 > last.y - near) {
    strokes = inkAbs(last).strokes.concat(strokes);
    doc.items = doc.items.filter(i => i !== last);
  }
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
  for (const st of strokes) for (const [x, y] of st) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const w = Math.max(4, x1 - x0), h = Math.max(4, y1 - y0);
  const it = normalize({ id: isInk(last) && !doc.items.includes(last) ? last.id : uid('k'), type: 'ink', x: x0, y: y0, w, h, ow: w, oh: h, sw, color: col, pen: penPref.style,
    strokes: strokes.map(st => st.map(([x, y, p]) => [+(x - x0).toFixed(2), +(y - y0).toFixed(2), +(p ?? .5).toFixed(2)])) });
  if (isInk(last) && !doc.items.includes(last) && last.g) it.g = last.g;
  doc.items.push(it); lastInk = { id: it.id, t: now() };
  commit(d.pre);
}

// ---------- connector routing ----------
const SIDES = { t: [0, -1], r: [1, 0], b: [0, 1], l: [-1, 0] };
function anchor(n, s) {
  const { x, y, w, h } = n;
  return s === 't' ? { x: x + w / 2, y } : s === 'r' ? { x: x + w, y: y + h / 2 } : s === 'b' ? { x: x + w / 2, y: y + h } : { x, y: y + h / 2 };
}
function segHits(p, q, r) {
  const x0 = r.x + 2, x1 = r.x + r.w - 2, y0 = r.y + 2, y1 = r.y + r.h - 2;
  if (p.y === q.y) { const a = Math.min(p.x, q.x), b = Math.max(p.x, q.x); return p.y > y0 && p.y < y1 && b > x0 && a < x1; }
  const a = Math.min(p.y, q.y), b = Math.max(p.y, q.y); return p.x > x0 && p.x < x1 && b > y0 && a < y1;
}
function route(A, B) {
  let best = null; const others = doc.items.filter(o => isNode(o) && o !== A && o !== B);
  for (const S in SIDES) for (const T in SIDES) {
    const s = anchor(A, S), t = anchor(B, T), [sx, sy] = SIDES[S], [tx, ty] = SIDES[T];
    let pts = null;
    if (sx && tx) { if (sx === -tx && (t.x - s.x) * sx > 24) { const m = (s.x + t.x) / 2; pts = [s, { x: m, y: s.y }, { x: m, y: t.y }, t]; } }
    else if (sy && ty) { if (sy === -ty && (t.y - s.y) * sy > 24) { const m = (s.y + t.y) / 2; pts = [s, { x: s.x, y: m }, { x: t.x, y: m }, t]; } }
    else if (sx) { const c = { x: t.x, y: s.y }; if ((c.x - s.x) * sx > 14 && (t.y - c.y) * -ty > 14) pts = [s, c, t]; }
    else { const c = { x: s.x, y: t.y }; if ((c.y - s.y) * sy > 14 && (t.x - c.x) * -tx > 14) pts = [s, c, t]; }
    if (!pts) continue;
    let cost = 0, bends = 0;
    for (let i = 1; i < pts.length; i++) {
      cost += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
      if (segHits(pts[i - 1], pts[i], A) || segHits(pts[i - 1], pts[i], B)) cost += 2000;
      for (const o of others) if (segHits(pts[i - 1], pts[i], o)) cost += 400;
    }
    for (let i = 1; i < pts.length - 1; i++) if (Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y) > .5) bends++;
    cost += bends * 30;
    if (!best || cost < best.cost) best = { cost, pts, S, T };
  }
  if (best) { const r = best.pts; r.sS = best.S; r.tS = best.T; return r; }
  const ac = { x: A.x + A.w / 2, y: A.y + A.h / 2 }, bc = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
  const S = Math.abs(bc.x - ac.x) > Math.abs(bc.y - ac.y) ? (bc.x > ac.x ? 'r' : 'l') : (bc.y > ac.y ? 'b' : 't'), T = { r: 'l', l: 'r', b: 't', t: 'b' }[S];
  const r = [anchor(A, S), anchor(B, T)]; r.sS = S; r.tS = T; return r;
}
function pathD(raw, r, cutE = true, cutS = false) {
  const pts = [];
  for (const p of raw) { const q = pts[pts.length - 1]; if (!q || Math.abs(q.x - p.x) + Math.abs(q.y - p.y) > .5) pts.push({ ...p }); }
  for (let i = pts.length - 2; i > 0; i--) { const a = pts[i - 1], b = pts[i], c = pts[i + 1]; if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) pts.splice(i, 1); }
  const L = pts.length; if (L < 2) return '';
  const trimEnd = (i, j) => { const e = pts[i], f = pts[j], len = Math.hypot(e.x - f.x, e.y - f.y) || 1, cut = Math.min(2, len / 2); pts[i] = { x: e.x - (e.x - f.x) / len * cut, y: e.y - (e.y - f.y) / len * cut }; };
  if (cutE) trimEnd(L - 1, L - 2); if (cutS) trimEnd(0, 1);
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < L - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const rr = Math.min(r, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
    const la = Math.hypot(a.x - b.x, a.y - b.y), lc = Math.hypot(c.x - b.x, c.y - b.y);
    d += `L${b.x + (a.x - b.x) / la * rr},${b.y + (a.y - b.y) / la * rr}Q${b.x},${b.y} ${b.x + (c.x - b.x) / lc * rr},${b.y + (c.y - b.y) / lc * rr}`;
  }
  return d + `L${pts[L - 1].x},${pts[L - 1].y}`;
}
function polyMid(pts) {
  let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let h = L / 2;
  for (let i = 1; i < pts.length; i++) { const sl = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (h <= sl) { const t = sl ? h / sl : 0; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; } h -= sl; }
  return pts[0];
}
function edgeGeom(a, b, e) {
  const pts = route(a, b), st = e.style || 'orth', ar = e.arrow || 'end', p0 = pts[0], p1 = pts[pts.length - 1];
  if (st === 'straight') {
    const cut = (p, q) => { const l = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: p.x + (q.x - p.x) / l * 2, y: p.y + (q.y - p.y) / l * 2 }; };
    const s0 = ar === 'both' ? cut(p0, p1) : p0, s1 = ar === 'none' ? p1 : cut(p1, p0);
    return { d: `M${s0.x},${s0.y}L${s1.x},${s1.y}`, mid: { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }, p0, p1 };
  }
  if (st === 'curve') {
    const L = Math.max(36, Math.hypot(p1.x - p0.x, p1.y - p0.y) * .42), [ax, ay] = SIDES[pts.sS], [bx, by] = SIDES[pts.tS];
    const c1 = { x: p0.x + ax * L, y: p0.y + ay * L }, c2 = { x: p1.x + bx * L, y: p1.y + by * L };
    return { d: `M${p0.x},${p0.y}C${c1.x},${c1.y} ${c2.x},${c2.y} ${p1.x},${p1.y}`, mid: { x: (p0.x + 3 * c1.x + 3 * c2.x + p1.x) / 8, y: (p0.y + 3 * c1.y + 3 * c2.y + p1.y) / 8 }, p0, p1 };
  }
  return { d: pathD(pts, 14, ar !== 'none', ar === 'both'), mid: polyMid(pts), p0, p1 };
}
const edgeGeomOf = e => { const a = find(e.from), b = find(e.to); return a && b ? edgeGeom(a, b, e) : null; };
const newEdge = (from, to) => ({ id: uid('e'), from, to, style: (doc.edgeDef || {}).style || 'orth', arrow: (doc.edgeDef || {}).arrow || 'end' });
function edgeSVG(e, exp) {
  const a = find(e.from), b = find(e.to); if (!a || !b) return '';
  const g = edgeGeom(a, b, e), d = g.d, s = !exp && sel.has(e.id);
  const an = exp ? null : animOf(e.id), drawing = an && an.name === 'draw';
  const mk = s ? 'arS' : 'ar', arw = e.arrow || 'end', marks = arw === 'none' ? '' : `marker-end="url(#${mk})"` + (arw === 'both' ? ` marker-start="url(#${mk})"` : '');
  let lbl = '';
  if (e.label && (exp || editing !== e.id)) {
    const lines = wrap(e.label, 160, LBL_FS, false); mctx.font = `400 ${LBL_FS}px ${FONT}`;
    const w = Math.max(...lines.map(l => mctx.measureText(l).width)) + 18, h = lines.length * LBL_FS * LH + 8, bx = g.mid.x - w / 2, by = g.mid.y - h / 2;
    lbl = `<rect x="${bx}" y="${by}" width="${w}" height="${h}" rx="${Math.min(10, h / 2)}" fill="${canvasBg(doc)}" ${s ? `stroke="${C.selSoft}" stroke-width="1"` : ''}/>` + textSVG(lines, { x: bx, y: by + 4, w, h: h - 8 }, LBL_FS, s ? C.selStrong : C.ink, false, 'center', 'middle');
  }
  const halo = s && !drawing ? `<path d="${d}" fill="none" stroke="${C.selStrong}" stroke-opacity=".18" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>` : '';
  const vis = `<path d="${d}" ${drawing ? `pathLength="1" class="vis an an-draw" style="animation-delay:-${Math.round(now() - an.t0)}ms"` : `class="vis" ${marks}`} fill="none" stroke="${s ? C.selStrong : C.line}" stroke-width="${s ? 2.8 : 2}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const fade = !exp && drag && drag.type === 'reconnect' && drag.eid === e.id ? ' style="opacity:.25"' : '';
  return `<g ${exp ? '' : `data-id="${e.id}" class="edge${s ? ' on' : ''}"`}${fade}>${halo}${exp ? '' : `<path d="${d}" class="hit"/>`}${vis}${lbl}</g>`;
}

// ---------- render ----------
let rafS = 0;
function render() { if (!rafS) rafS = requestAnimationFrame(() => { rafS = 0; draw(); }); }
function draw() {
  const nodes = doc.items.filter(isNode), texts = doc.items.filter(isText);
  texts.sort((a, b) => (sel.has(a.id) || editing === a.id ? 1 : 0) - (sel.has(b.id) || editing === b.id ? 1 : 0));
  for (const id of sel) if (!prevSel.has(id) && !anims.has(id)) { const o = find(id); if (o && !isEdge(o)) anim(id, 'sel', 340); }
  prevSel = new Set(sel);
  const edges = [...doc.edges].sort((a, b) => (sel.has(a.id) ? 1 : 0) - (sel.has(b.id) ? 1 : 0));
  gE.innerHTML = edges.map(e => edgeSVG(e)).join('');
  ghosts = ghosts.filter(g => now() - g.t0 < 230);
  gG.innerHTML = ghosts.map(g => `<g class="an an-out" style="animation-delay:-${Math.round(now() - g.t0)}ms">${g.html}</g>`).join('');
  gN.innerHTML = nodes.map(n => nodeSVG(n)).join('');
  gT.innerHTML = texts.map(t => textItemSVG(t)).join('');
  gK.innerHTML = doc.items.filter(isInk).map(k => inkSVG(k)).join('');
  drawUI();
  $('#hint').style.display = doc.items.length ? 'none' : 'block';
  if (editing) placeEditor();
}
function drawUI() {
  const k = view.k, sw = 1.2 / k, r = 5 / k; let h = '';
  const handles = (b, isTxt) => {
    const pts = { nw: [0, 0], n: [.5, 0], ne: [1, 0], e: [1, .5], se: [1, 1], s: [.5, 1], sw: [0, 1], w: [0, .5] };
    return `<g class="${isTxt ? 'tbx' : ''}">` + Object.entries(pts).map(([k2, [u, v]]) => `<circle data-handle="${k2}" cx="${b.x + b.w * u}" cy="${b.y + b.h * v}" r="${r}" fill="${C.dark ? C.raised : '#fff'}" stroke="${C.sel}" stroke-width="${sw * 1.2}"/>`).join('') + '</g>';
  };
  const selItems = [...sel].map(find).filter(o => o && !isEdge(o));
  const single = selItems.length === 1 && !(drag && drag.type === 'move' && drag.moved) && !selItems[0].locked;
  for (const it of selItems) {
    const b = bbox(it), ua = animOf(it.id), uaa = ua && ua.name !== 'lift' && ua.name !== 'magnet' && ua.name !== 'nope' ? ua : null;
    h += `<g${animAttr(uaa)}>`;
    if (isText(it) || isInk(it)) h += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${C.sel}" stroke-width="${sw}" stroke-dasharray="${5 / k} ${4 / k}" pointer-events="none"/>`;
    else { const o = 5 / k; h += `<rect x="${b.x - o}" y="${b.y - o}" width="${b.w + 2 * o}" height="${b.h + 2 * o}" rx="${it.shape === 'circle' || it.shape === 'capsule' ? Math.min(b.w, b.h) / 2 + o : Math.min(it.radius + o, 30)}" fill="none" stroke="${C.selSoft}" stroke-width="${sw}" pointer-events="none"/>`; }
    if (single) h += handles(b, isText(it));
    h += '</g>';
    if (it.locked) h += `<g transform="translate(${b.x + b.w - 8 / k} ${b.y - 18 / k}) scale(${1 / k})" pointer-events="none"><rect x="-8" y="-1" width="16" height="12" rx="3" fill="${C.selSoft}"/><path d="M-4 -1v-3a4 4 0 018 0v3" fill="none" stroke="${C.selSoft}" stroke-width="1.6"/></g>`;
  }
  // group outlines
  const gb = new Map();
  for (const it of selItems) if (it.g) { const b = bbox(it), u = gb.get(it.g); gb.set(it.g, u ? unionBox([u, b]) : b); }
  for (const [, b] of gb) { const o = 12 / k; h += `<rect x="${b.x - o}" y="${b.y - o}" width="${b.w + 2 * o}" height="${b.h + 2 * o}" rx="${14 / k}" fill="none" stroke="${C.selSoft}" stroke-width="${sw}" stroke-dasharray="${3 / k} ${3 / k}" pointer-events="none"/><text x="${b.x - o}" y="${b.y - o - 5 / k}" font-size="${11 / k}" fill="${C.selStrong}" pointer-events="none">Group</text>`; }
  for (const o of [...sel].map(find)) if (isEdge(o)) {
    if (drag && drag.type === 'reconnect' && drag.eid === o.id) continue;
    const a = find(o.from), b = find(o.to); if (!a || !b) continue;
    const g = edgeGeom(a, b, o);
    [['from', g.p0], ['to', g.p1]].forEach(([end, p]) => { h += `<circle data-eend="${end}" data-edge="${o.id}" cx="${p.x}" cy="${p.y}" r="${5.5 / k}" fill="${C.dark ? C.raised : '#fff'}" stroke="${C.selStrong}" stroke-width="${1.8 / k}"><title>Drag onto another node to reconnect</title></circle>`; });
  }
  // connection handles
  const cid = drag && drag.type === 'connect' ? null : (hoverId || (selItems.length === 1 && isNode(selItems[0]) ? selItems[0].id : null));
  const cn = cid && find(cid);
  if (isNode(cn) && (tool === 'select' || tool === 'conn') && !editing && !(drag && drag.type !== 'connect' && drag.type !== 'none')) {
    const off = 28 / k;
    for (const s in SIDES) {
      const p = anchor(cn, s), cx = p.x + SIDES[s][0] * off, cy = p.y + SIDES[s][1] * off, q = 3.5 / k;
      h += `<g data-conn="${s}" data-node="${cn.id}" class="qa"><title>Click: add a connected node · Drag: draw a connector</title><circle cx="${cx}" cy="${cy}" r="${8 / k}" fill="${C.dark ? C.raised : '#fff'}" stroke="${C.selSoft}" stroke-width="${sw * 1.2}"/><path d="M${cx - q},${cy}h${2 * q}M${cx},${cy - q}v${2 * q}" stroke="${C.sel}" stroke-width="${1.6 / k}" stroke-linecap="round" pointer-events="none"/></g>`;
    }
  }
  if (drag && drag.type === 'move' && drag.guides) {
    for (const l of drag.guides.lines) h += `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${C.selSoft}" stroke-width="${1 / k}" pointer-events="none"/>`;
    for (const l of drag.guides.spaces) {
      const hz = Math.abs(l.y1 - l.y2) < .01, t = 4 / k, len = Math.round(hz ? Math.abs(l.x2 - l.x1) : Math.abs(l.y2 - l.y1));
      h += `<g stroke="${C.selStrong}" stroke-width="${1.2 / k}" pointer-events="none"><line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"/>` +
        (hz ? `<line x1="${l.x1}" y1="${l.y1 - t}" x2="${l.x1}" y2="${l.y1 + t}"/><line x1="${l.x2}" y1="${l.y2 - t}" x2="${l.x2}" y2="${l.y2 + t}"/>` : `<line x1="${l.x1 - t}" y1="${l.y1}" x2="${l.x1 + t}" y2="${l.y1}"/><line x1="${l.x2 - t}" y1="${l.y2}" x2="${l.x2 + t}" y2="${l.y2}"/>`) +
        `</g><text x="${hz ? (l.x1 + l.x2) / 2 : l.x1 + 7 / k}" y="${hz ? l.y1 - 7 / k : (l.y1 + l.y2) / 2 + 4 / k}" font-size="${10 / k}" fill="${C.selStrong}" text-anchor="${hz ? 'middle' : 'start'}" pointer-events="none">${len}</text>`;
    }
  }
  if (drag && drag.type === 'ink' && drag.pts.length) h += `<g fill="${penPref.color === 'auto' ? C.ink : penPref.color}" pointer-events="none">${strokeEls(drag.pts, penPref.sw, penPref.style)}</g>`;
  if (drag && drag.type === 'lasso' && drag.pts.length > 1) h += `<path d="M${drag.pts.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('L')}Z" fill="${C.sel}" fill-opacity=".07" stroke="${C.sel}" stroke-width="${1.4 / k}" stroke-dasharray="${5 / k} ${4 / k}" stroke-linejoin="round" pointer-events="none"/>`;
  if (lp && lp.ring) h += `<circle cx="${lp.p.x}" cy="${lp.p.y}" r="4" fill="none" stroke="${C.sel}" stroke-width="${2 / k}" style="animation:k-ring .5s ease-out forwards" pointer-events="none"/>`;
  if (drag && drag.type === 'reconnect' && drag.cur) {
    const e2 = find(drag.eid), fx = e2 && find(drag.end === 'from' ? e2.to : e2.from), tg = drag.target && find(drag.target);
    if (fx) {
      if (tg) h += glowFor(tg);
      let pts;
      if (tg) pts = drag.end === 'from' ? route(tg, fx) : route(fx, tg);
      else { const c = drag.cur, cx = fx.x + fx.w / 2, cy = fx.y + fx.h / 2, sd = Math.abs(c.x - cx) / fx.w > Math.abs(c.y - cy) / fx.h ? (c.x > cx ? 'r' : 'l') : (c.y > cy ? 'b' : 't'), a = anchor(fx, sd); pts = drag.end === 'from' ? [c, a] : [a, c]; }
      const ar = e2.arrow || 'end';
      h += `<path d="${pathD(pts, 14, ar !== 'none', ar === 'both')}" fill="none" stroke="${C.sel}" stroke-width="2" stroke-dasharray="${6 / k} ${4 / k}" ${ar === 'none' ? '' : 'marker-end="url(#arS)"'} ${ar === 'both' ? 'marker-start="url(#arS)"' : ''} pointer-events="none"/>`;
      if (!tg) h += `<circle cx="${drag.cur.x}" cy="${drag.cur.y}" r="${5.5 / k}" fill="${C.sel}" pointer-events="none"/>`;
    }
  }
  if (drag && drag.type === 'marquee' && drag.cur) { const m = rectOf(drag.start, drag.cur); h += `<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="${C.sel}" fill-opacity=".08" stroke="${C.selSoft}" stroke-width="${sw}" rx="${3 / k}"/>`; }
  if (drag && drag.type === 'create' && drag.cur) { const m = rectOf(drag.start, drag.cur); h += shapeEl({ ...m, shape: drag.shape, radius: 24 }, `fill="${C.sel}" fill-opacity=".12" stroke="${C.selSoft}" stroke-width="${sw}" stroke-dasharray="${4 / k} ${3 / k}"`); }
  if (drag && drag.type === 'connect' && drag.cur) {
    const a = find(drag.from), tg = drag.target && find(drag.target);
    if (tg) h += glowFor(tg);
    const pts = tg ? route(a, tg) : (() => { const s = anchor(a, drag.side), c = drag.cur; return SIDES[drag.side][0] ? [s, { x: c.x, y: s.y }, c] : [s, { x: s.x, y: c.y }, c]; })();
    h += `<path d="${pathD(pts, 14)}" fill="none" stroke="${C.sel}" stroke-width="2" stroke-dasharray="${6 / k} ${4 / k}" marker-end="url(#arS)" pointer-events="none"/>`;
  }
  gUI.innerHTML = h;
}
function glowFor(tg) {
  const k = view.k, o = 7 / k, B = { ...tg, x: tg.x - o, y: tg.y - o, w: tg.w + 2 * o, h: tg.h + 2 * o, radius: tg.radius + o };
  return `<g class="an an-glow" style="animation-delay:-${Math.round(now() - drag.targetT0)}ms" pointer-events="none">${shapeEl(B, `fill="none" stroke="${C.sel}" stroke-opacity=".25" stroke-width="${7 / k}"`)}${shapeEl(B, `fill="none" stroke="${C.selSoft}" stroke-width="${1.7 / k}"`)}</g>`;
}
const unionBox = bs => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const b of bs) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); } return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
function applyView() {
  world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
  $('#zoomv').textContent = Math.round(view.k * 100) + '%';
  drawUI(); if (editing) placeEditor(); scheduleSave();
}
const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

// ---------- history & persistence ----------
function commit(pre) { undoS.push(pre); if (undoS.length > 200) undoS.shift(); redoS = []; changed(); }
function changed() { render(); renderPanel(); scheduleSave(); $('#undo').disabled = !undoS.length; $('#redo').disabled = !redoS.length; }
function restore(s) { const o = JSON.parse(s); doc.items = o.items; doc.edges = o.edges; for (const id of [...sel]) if (!find(id)) sel.delete(id); }
function undo() { if (!undoS.length) return; closeEditor(); physStop(); redoS.push(snap()); restore(undoS.pop()); changed(); }
function redo() { if (!redoS.length) return; closeEditor(); physStop(); undoS.push(snap()); restore(redoS.pop()); changed(); }
let saveT = 0, curId = null, index = { current: null, list: [] };
const mem = {};
const sget = k => { try { const v = localStorage.getItem(k); if (v != null) return v; } catch (e) { } return mem[k] ?? null; };
const sset = (k, v) => { mem[k] = v; try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const sdel = k => { delete mem[k]; try { localStorage.removeItem(k); } catch (e) { } };
const saveIndex = () => sset('flowspace.index', JSON.stringify(index));
function saveNow() {
  if (!curId) return true;
  const ok = sset('flowspace.doc.' + curId, JSON.stringify({ doc, view }));
  const ent = index.list.find(x => x.id === curId); if (ent) { ent.name = doc.name; ent.updated = Date.now(); }
  saveIndex(); return ok;
}
function scheduleSave() {
  $('#status').classList.add('busy'); $('#status span').textContent = 'Saving…';
  clearTimeout(saveT); saveT = setTimeout(() => {
    $('#status span').textContent = saveNow() ? 'Saved locally' : 'Not saved (storage unavailable)';
    $('#status').classList.remove('busy');
  }, 400);
}
const blankDoc = name => ({ name: name || 'Untitled canvas', bg: (doc && doc.bg) || 'blue', theme: (doc && doc.theme) || 'mist', edgeDef: { style: 'orth', arrow: 'end' }, phys: { on: false, strength: 50, gap: 24 }, items: [], edges: [] });
function normDoc(d) {
  d.items = (d.items || []).map(normalize); d.edges = (d.edges || []).filter(x => x.from && x.to);
  d.phys = Object.assign({ on: false, strength: 50, gap: 24 }, d.phys || {}); d.edgeDef = Object.assign({ style: 'orth', arrow: 'end' }, d.edgeDef || {});
  d.bg = d.bg === 'white' || d.bg === 'dark' ? d.bg : 'blue'; d.theme = THEMES[d.theme] ? d.theme : 'mist'; d.name = d.name || 'Untitled canvas'; return d;
}
function readCanvas(id) { try { const o = JSON.parse(sget('flowspace.doc.' + id)); if (o && o.doc && Array.isArray(o.doc.items)) return o; } catch (e) { } return null; }
function openCanvas(id, boot) {
  if (!boot && curId) { closeEditor(); physStop(); clearTimeout(saveT); saveNow(); }
  const o = readCanvas(id) || { doc: blankDoc(), view: null };
  curId = id; index.current = id; saveIndex();
  doc = normDoc(o.doc); undoS = []; redoS = []; sel = new Set(); prevSel = new Set(); anims.clear(); ghosts = []; hoverId = null; drag = null; pendingDel = null;
  $('#fname').value = doc.name; document.title = doc.name + ' · FlowSpace';
  setBg(doc.bg); renderPhys(); draw(); changed();
  if (o.view && o.view.k) { view = o.view; applyView(); } else requestAnimationFrame(() => fitView(false));
  if (!boot && !RM) { world.style.animation = 'none'; requestAnimationFrame(() => { world.style.animation = 'k-fade .3s ease-out'; }); }
}
function uniqueName(base) { const names = new Set(index.list.map(x => x.name)); if (!names.has(base)) return base; let i = 2; while (names.has(base + ' ' + i)) i++; return base + ' ' + i; }
function newCanvas(fromDoc, label) {
  closeMenus(); if (curId) { closeEditor(); saveNow(); }
  const id = uid('c'), d = fromDoc || blankDoc(); d.name = uniqueName(fromDoc ? d.name : 'Untitled canvas');
  index.list.push({ id, name: d.name, updated: Date.now() });
  sset('flowspace.doc.' + id, JSON.stringify({ doc: d, view: null }));
  openCanvas(id); toast(label || `Created “${d.name}”`);
}
function dupCanvas(id) {
  if (id === curId) saveNow();
  const o = readCanvas(id); if (!o) return;
  const d = JSON.parse(JSON.stringify(o.doc)); d.name = d.name + ' copy'; newCanvas(d, `Duplicated as “${uniqueName(d.name)}”`);
}
function deleteCanvas(id) {
  if (index.list.length < 2) { toast('Keep at least one canvas'); return; }
  const ent = index.list.find(x => x.id === id); index.list = index.list.filter(x => x.id !== id); sdel('flowspace.doc.' + id); pendingDel = null;
  if (id === curId) { curId = null; const next = [...index.list].sort((a, b) => b.updated - a.updated)[0]; openCanvas(next.id, true); if (!RM) { world.style.animation = 'none'; requestAnimationFrame(() => { world.style.animation = 'k-fade .3s ease-out'; }); } }
  else saveIndex();
  renderFiles(); toast(`Deleted “${ent ? ent.name : ''}”`);
}
let pendingDel = null;
function relTime(t) {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + ' min ago'; if (d < 86400) return Math.floor(d / 3600) + ' h ago';
  return new Date(t).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
function thumbSVG(d) {
  const P = palOf(d), bg = d ? canvasBg(d) : P.cbg, its = (d && d.items) || [];
  if (!its.length) return `<svg class="th" viewBox="0 0 58 40"><rect width="58" height="40" fill="${bg}"/></svg>`;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of its) { const h = it.type === 'text' ? 30 : it.h; x0 = Math.min(x0, it.x); y0 = Math.min(y0, it.y); x1 = Math.max(x1, it.x + it.w); y1 = Math.max(y1, it.y + h); }
  const sc = Math.min(48 / (x1 - x0 || 1), 30 / (y1 - y0 || 1)), ox = (58 - (x1 - x0) * sc) / 2, oy = (40 - (y1 - y0) * sc) / 2;
  const F = {}; for (const k in P.f) F[k] = k === 'white' ? P.f.white[0] : P.f[k][1];
  return `<svg class="th" viewBox="0 0 58 40"><rect width="58" height="40" fill="${bg}"/>` + its.map(it => {
    const x = ox + (it.x - x0) * sc, y = oy + (it.y - y0) * sc, w = Math.max(1.5, it.w * sc);
    if (it.type === 'text') return `<rect x="${x}" y="${y + 1}" width="${w * .8}" height="1.6" rx=".8" fill="${P.ink2}"/>`;
    if (it.type === 'ink') return `<path d="M${x},${y + it.h * sc * .6}q${w / 4},${-it.h * sc * .5} ${w / 2},0t${w / 2},0" fill="none" stroke="${P.ink2}" stroke-width=".9"/>`;
    const h = Math.max(1.5, it.h * sc), rx = it.shape === 'circle' || it.shape === 'capsule' ? Math.min(w, h) / 2 : Math.min(3, h / 3);
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${F[it.fill] || it.fill || P.f.white[0]}" stroke="${P.f.white[2]}" stroke-width=".5"/>`;
  }).join('') + '</svg>';
}
function renderFiles() {
  if (curId) saveNow();
  const list = [...index.list].sort((a, b) => b.updated - a.updated);
  const IC_DUP = '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg>';
  const IC_DEL = '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>';
  $('#mFiles').innerHTML = `<div class="mh"><b>My canvases</b><span>${list.length} · stored in this browser</span></div>
  <button class="newc" data-f="new">＋ New canvas<small>Alt N</small></button><hr>` + list.map(x => {
    if (pendingDel === x.id) return `<div class="fconf">Delete “${esc(x.name)}”? This can’t be undone.<div><button class="y" data-delyes="${x.id}">Delete</button><button class="n" data-delno="1">Cancel</button></div></div>`;
    const o = readCanvas(x.id);
    return `<div class="frow ${x.id === curId ? 'cur' : ''}" data-open="${x.id}">${thumbSVG(o && o.doc)}<div class="fi"><div class="fn">${esc(x.name)}</div><div class="ft">${x.id === curId ? 'Current · ' : ''}${relTime(x.updated)} · ${o ? o.doc.items.filter(i => i.type === 'node').length : 0} nodes</div></div>
      <button class="ib" data-dup="${x.id}" title="Duplicate canvas">${IC_DUP}</button><button class="ib" data-delc="${x.id}" title="Delete">${IC_DEL}</button></div>`;
  }).join('');
}
function load() {
  try { index = JSON.parse(sget('flowspace.index')); } catch (e) { index = null; }
  if (!index || !Array.isArray(index.list) || !index.list.length) {
    index = { current: null, list: [] };
    let old = null; try { old = JSON.parse(sget('flowspace.v1')); } catch (e) { }
    const id = uid('c'), d = old && old.doc && Array.isArray(old.doc.items) ? old.doc : sample();
    index.list.push({ id, name: d.name || 'Untitled canvas', updated: Date.now() }); index.current = id;
    sset('flowspace.doc.' + id, JSON.stringify({ doc: d, view: old && old.view || null })); saveIndex();
  }
  const id = index.list.some(x => x.id === index.current) ? index.current : index.list[0].id;
  openCanvas(id, true);
}

// ---------- coordinates & hit testing ----------
function toWorld(e) { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k }; }
const inside = (p, b, m = 0) => p.x >= b.x - m && p.x <= b.x + b.w + m && p.y >= b.y - m && p.y <= b.y + b.h + m;
function nodeAt(p, m = 0, except) { const ns = doc.items.filter(isNode); for (let i = ns.length - 1; i >= 0; i--) if (ns[i].id !== except && inside(p, ns[i], m)) return ns[i]; return null; }

// ---------- editing ----------
function openEditor(id, pre) {
  const it = find(id); if (!it || isInk(it)) return;
  closeEditor(); editing = id; sel = new Set([id]); if (anims.has(id)) prevSel.add(id);
  const E = isEdge(it);
  editing_pre = pre || snap(); editing_orig = E ? (it.label || '') : it.text; editing_new = !!pre;
  ed.textContent = editing_orig;
  Object.assign(ed.style, { fontSize: (E ? LBL_FS : defFs(it)) + 'px', color: E ? C.ink : tc(it), fontWeight: !E && it.bold ? 700 : 400, textAlign: E ? 'center' : it.align, fontFamily: FONT, width: '100%' });
  edwrap.classList.toggle('lbl', E);
  edwrap.style.display = 'flex';
  placeEditor(); render(); renderPanel();
  setTimeout(() => {
    if (editing !== id) return; ed.focus();
    const r = document.createRange(); r.selectNodeContents(ed); if (pre) r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }, 0);
}
let editing_pre = null, editing_orig = '', editing_new = false;
function placeEditor() {
  const it = find(editing); if (!it) return;
  let b;
  if (isEdge(it)) { const g = edgeGeomOf(it); if (!g) return; b = { x: g.mid.x - 88, y: g.mid.y - LBL_FS * LH / 2 - 4, w: 176 }; edwrap.style.height = 'auto'; edwrap.style.justifyContent = 'center'; }
  else if (isText(it)) { b = { x: it.x + TPX, y: it.y + TPY, w: it.w - 2 * TPX }; edwrap.style.height = 'auto'; edwrap.style.justifyContent = 'flex-start'; }
  else { b = innerBox(it); edwrap.style.height = b.h + 'px'; edwrap.style.justifyContent = it.valign === 'top' ? 'flex-start' : it.valign === 'bottom' ? 'flex-end' : 'center'; }
  edwrap.style.width = b.w + 'px';
  const r = svg.getBoundingClientRect();
  edwrap.style.transform = `translate(${r.left + view.x + b.x * view.k}px,${r.top + view.y + b.y * view.k}px) scale(${view.k})`;
}
function readEd() { return ed.innerText.replace(/\n$/, ''); }
ed.addEventListener('input', () => { const it = find(editing); if (!it) return; if (isEdge(it)) it.label = readEd(); else { it.text = readEd(); fitNode(it); } render(); });
function closeEditor() {
  if (!editing) return;
  const it = find(editing), id = editing; editing = null; edwrap.style.display = 'none'; edwrap.classList.remove('lbl');
  if (it && isEdge(it)) {
    const v = readEd().trim(); if (v) it.label = v; else delete it.label;
    if ((it.label || '') !== editing_orig) commit(editing_pre); else changed();
  } else if (it) {
    it.text = readEd(); fitNode(it);
    if (isText(it) && !it.text.trim()) { doc.items = doc.items.filter(i => i !== it); sel.delete(id); if (!editing_new) commit(editing_pre); else changed(); }
    else if (it.text !== editing_orig || editing_new) commit(editing_pre);
    else changed();
  }
  ed.blur();
}
ed.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); closeEditor(); return; }
  if (e.key === 'Tab') { e.preventDefault(); const it = find(editing); if (isNode(it)) { closeEditor(); quickAdd(it, flowSide(it), it); } else closeEditor(); return; }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'Period' || e.code === 'Comma')) { e.preventDefault(); const it = find(editing); if (it && !isEdge(it)) { stepFs(e.code === 'Period' ? 1 : -1); ed.style.fontSize = defFs(it) + 'px'; placeEditor(); } }
});
try { ed.contentEditable = 'plaintext-only'; } catch (e) { }
if (ed.contentEditable !== 'plaintext-only') ed.contentEditable = 'true';
ed.addEventListener('paste', e => { if (ed.contentEditable === 'true') { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); } });

// ---------- pointer interaction ----------
function setTool(t) {
  tool = t; closeEditor(); if (painter) stopBrush();
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  app.className = app.className.replace(/\bt-\w+/g, '') + ' t-' + (DEF_SIZE[t] ? 'shape' : t);
  drawUI(); if (doc) renderPanel();
}
function startPinch() {
  clearLP();
  if (drag) {
    if ((drag.type === 'move' || drag.type === 'resize') && drag.moved) { restore(drag.pre); }
    drag = null; app.classList.remove('grabbing');
  }
  const [a, b] = [...touches.values()];
  pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: { ...view } };
  cancelAnimationFrame(viewAnim); draw();
}
function doPinch() {
  const [a, b] = [...touches.values()]; if (!a || !b) return;
  const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, r = svg.getBoundingClientRect(), v0 = pinch.v0;
  const k = Math.min(4, Math.max(.1, v0.k * d / pinch.d0)), wx = (pinch.m0.x - r.left - v0.x) / v0.k, wy = (pinch.m0.y - r.top - v0.y) / v0.k;
  view = { k, x: m.x - r.left - wx * k, y: m.y - r.top - wy * k }; applyView();
}
const panDrag = e => ({ type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y });
svg.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (e.pointerType === 'pen') penSeen = true;
  if (e.pointerType === 'touch') { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size >= 2) { startPinch(); return; } }
  if (pinch) return;
  dragPid = e.pointerId;
  const ae = document.activeElement; if (ae && ae !== document.body && ae !== ed && ae !== svg) ae.blur();
  try { svg.focus({ preventScroll: true }); } catch (er) { }
  if (editing) closeEditor();
  closeMenus();
  const p = toWorld(e), tgt = e.target.closest('[data-id],[data-handle],[data-conn],[data-eend]');
  try { svg.setPointerCapture(e.pointerId); } catch (er) { }
  cancelAnimationFrame(viewAnim);
  if (e.button === 1 || tool === 'hand' || spaceDown) { drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; app.classList.add('grabbing'); return; }
  if (e.pointerType === 'pen' && (e.buttons & 32)) { drag = { type: 'erase', pre: snap(), n: 0 }; eraseAt(e); return; }
  if (e.button !== 0) return;
  if (painter) {
    const it = tgt && tgt.dataset.id && find(tgt.dataset.id);
    if (it) { const pre = snap(); if (applyStyleTo(it)) { anim(it.id, 'settle', 300); commit(pre); toast('Style applied'); } else toast('Those styles don’t match this object'); }
    stopBrush(); return;
  }
  const inkStart = () => { sel.clear(); renderPanel(); drag = { type: 'ink', pts: [[p.x, p.y, e.pointerType === 'pen' ? Math.max(.08, e.pressure) : .6]], pre: snap(), lt: e.timeStamp, sx: e.clientX, sy: e.clientY, pp: .6 }; drawUI(); };
  // long-press: menu on objects, lasso on empty
  clearLP();
  if (e.pointerType !== 'mouse' && (tool === 'select' || tool === 'pen' || tool === 'lasso')) {
    lp = { x: e.clientX, y: e.clientY, p, pt: e.pointerType, t: setTimeout(onLongPress, 480) };
  }
  if (tool === 'lasso' || (tool === 'select' && e.altKey && !tgt)) { sel.clear(); changed(); drag = { type: 'lasso', pts: [[p.x, p.y]], menu: e.pointerType !== 'mouse' }; return; }
  if (tool === 'pen') { if (e.pointerType === 'touch' && penSeen) { drag = panDrag(e); return; } inkStart(); return; }
  if (e.pointerType === 'pen' && tool === 'select' && (!tgt || isInk(find(tgt.dataset.id)))) { inkStart(); return; }
  const tNow = now(), dbl = lastDown && tNow - lastDown.t < 400 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6;
  lastDown = dbl ? null : { t: tNow, x: e.clientX, y: e.clientY };
  if (dbl && tool === 'select' && !(tgt && (tgt.dataset.conn || tgt.dataset.handle))) { onDouble(e, p, tgt); return; }
  if (DEF_SIZE[tool]) { drag = { type: 'create', shape: tool, start: p }; return; }
  if (tool === 'text') {
    const pre = snap(), t = normalize({ id: uid('t'), type: 'text', x: p.x - TPX, y: p.y - TEXT_FS * LH / 2 - TPY, w: 240, text: '' });
    doc.items.push(t); anim(t.id, 'pop', 300); setTool('select'); openEditor(t.id, pre); return;
  }
  if (tgt && tgt.dataset.eend) { drag = { type: 'reconnect', eid: tgt.dataset.edge, end: tgt.dataset.eend, cur: p, pre: snap() }; drawUI(); return; }
  if (tgt && tgt.dataset.conn) { drag = { type: 'connect', from: tgt.dataset.node, side: tgt.dataset.conn, cur: p, sp: p }; return; }
  if (tool === 'conn') { const n = nodeAt(p); if (n) { const c = { x: n.x + n.w / 2, y: n.y + n.h / 2 }; drag = { type: 'connect', from: n.id, side: Math.abs(p.x - c.x) / n.w > Math.abs(p.y - c.y) / n.h ? (p.x > c.x ? 'r' : 'l') : (p.y > c.y ? 'b' : 't'), cur: p }; } else drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; return; }
  if (tgt && tgt.dataset.handle) { const it = [...sel].map(find).find(o => o && !isEdge(o)); if (it) drag = { type: 'resize', h: tgt.dataset.handle, id: it.id, o: { ...bbox(it) }, start: p, pre: snap() }; return; }
  const id = tgt && tgt.dataset.id, it = id && find(id);
  if (it) {
    const grp = expandGroups(new Set([id]));
    if (e.shiftKey || e.metaKey || e.ctrlKey) { if (sel.has(id)) grp.forEach(x => sel.delete(x)); else grp.forEach(x => sel.add(x)); changed(); if (!sel.has(id)) return; }
    else if (!sel.has(id)) { sel = grp; changed(); }
    if (isEdge(it)) return;
    const orig = {}; for (const sid of sel) { const o = find(sid); if (o && !isEdge(o) && !o.locked) orig[sid] = { x: o.x, y: o.y }; }
    drag = { type: 'move', start: p, orig, pre: snap(), moved: false, clickId: id, multi: sel.size > 1 && !(e.shiftKey || e.metaKey || e.ctrlKey) };
    return;
  }
  if (e.pointerType === 'touch') { sel.clear(); changed(); drag = panDrag(e); return; }
  if (!e.shiftKey) { sel.clear(); changed(); }
  drag = { type: 'marquee', start: p, base: new Set(sel) };
});
function eraseAt(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest('[data-id]'), it = t && find(t.dataset.id);
  if (isInk(it) && !it.locked) { ghosts.push({ html: inkSVG(it, true), t0: now() }); doc.items = doc.items.filter(i => i !== it); sel.delete(it.id); drag.n++; render(); setTimeout(render, 250); }
}
svg.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pinch) { doPinch(); return; } }
  if (pinch) return;
  if (drag && dragPid !== null && e.pointerId !== dragPid) return;
  const p = toWorld(e);
  if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 9) clearLP();
  if (drag && drag.type === 'ink') {
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      const q = toWorld(ev), l = drag.pts[drag.pts.length - 1], dScr = Math.hypot(q.x - l[0], q.y - l[1]) * view.k;
      if (dScr <= 1.2) continue;
      const dt = Math.max(1, ev.timeStamp - drag.lt), v = dScr / dt; drag.lt = ev.timeStamp;
      let pr;
      if (ev.pointerType === 'pen' && ev.pressure > 0) pr = Math.max(.08, ev.pressure) * (1 - Math.min(.2, v * .04));
      else { const target = Math.min(1, Math.max(.28, 1.05 - v * .32)); pr = drag.pp = drag.pp * .72 + target * .28; }
      const sm = .45, nx = l[0] + (q.x - l[0]) * (1 - sm), ny = l[1] + (q.y - l[1]) * (1 - sm);
      drag.pts.push([nx, ny, pr]); drag.raw = [q.x, q.y, pr];
    }
    drawUI(); return;
  }
  if (drag && drag.type === 'lasso') { const l = drag.pts[drag.pts.length - 1]; if (Math.hypot(p.x - l[0], p.y - l[1]) * view.k > 3) drag.pts.push([p.x, p.y]); drawUI(); return; }
  if (drag && drag.type === 'erase') { eraseAt(e); return; }
  if (drag && drag.type === 'reconnect') {
    drag.cur = p; const e2 = find(drag.eid), fixed = e2 && (drag.end === 'from' ? e2.to : e2.from), t = nodeAt(p, 0, fixed), tid = t ? t.id : null;
    if (tid !== drag.target) { drag.target = tid; drag.targetT0 = now(); render(); } else drawUI();
    return;
  }
  if (!drag) {
    const n = (tool === 'select' || tool === 'conn') ? (nodeAt(p, 0) || (hoverId && nodeAt(p, 30 / view.k))) : null;
    const nid = n ? n.id : null; if (nid !== hoverId) { hoverId = nid; drawUI(); }
    return;
  }
  if (drag.type === 'pan') { view.x = drag.vx + e.clientX - drag.sx; view.y = drag.vy + e.clientY - drag.sy; applyView(); return; }
  if (drag.type === 'move') {
    let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) * view.k < 3) return;
    if (!drag.moved) drag.liftT0 = now();
    drag.moved = true;
    const sn = snapMove(dx, dy, e.altKey); dx = sn.dx; dy = sn.dy; drag.guides = sn.guides;
    for (const id in drag.orig) { const o = find(id); o.x = Math.round(drag.orig[id].x + dx); o.y = Math.round(drag.orig[id].y + dy); }
    if (physOn()) { for (const id in drag.orig) phys.fixed.add(id); physKick(); }
    render(); return;
  }
  if (drag.type === 'resize') {
    const it = find(drag.id), o = drag.o, dx = p.x - drag.start.x, dy = p.y - drag.start.y, hd = drag.h, minW = isText(it) ? 40 : isInk(it) ? 8 : 36, minH = isInk(it) ? 8 : 28;
    let { x, y, w, h } = o;
    if (hd.includes('e')) w = Math.max(minW, o.w + dx);
    if (hd.includes('w')) { w = Math.max(minW, o.w - dx); x = o.x + o.w - w; }
    if (!isText(it)) {
      if (hd.includes('s')) h = Math.max(minH, o.h + dy);
      if (hd.includes('n')) { h = Math.max(minH, o.h - dy); y = o.y + o.h - h; }
      if ((e.shiftKey !== isInk(it)) && hd.length === 2) { const s = Math.max(w / o.w, h / o.h); w = o.w * s; h = o.h * s; if (hd.includes('w')) x = o.x + o.w - w; if (hd.includes('n')) y = o.y + o.h - h; }
      it.h = Math.round(h); it.y = Math.round(y);
    }
    it.x = Math.round(x); it.w = Math.round(w); drag.moved = true; fitNode(it);
    if (physOn() && isNode(it)) { phys.fixed.add(it.id); physKick(); }
    render(); renderPanelNums(); return;
  }
  if (drag.type === 'marquee') {
    drag.cur = p; const m = rectOf(drag.start, p); sel = new Set(drag.base);
    for (const it of doc.items) { const b = bbox(it); if (b.x < m.x + m.w && b.x + b.w > m.x && b.y < m.y + m.h && b.y + b.h > m.y) sel.add(it.id); }
    expandGroups(sel); drawUI(); return;
  }
  if (drag.type === 'create') { drag.cur = p; drawUI(); return; }
  if (drag.type === 'connect') {
    drag.cur = p; const t = nodeAt(p, 0, drag.from), tid = t ? t.id : null;
    if (tid !== drag.target) { drag.target = tid; drag.targetT0 = now(); render(); } else drawUI();
  }
});
function endDrag(e) {
  if (!drag) return;
  const d = drag; drag = null; hoverId = null; dragPid = null; app.classList.remove('grabbing');
  if (d.type === 'ink') { if (d.raw) d.pts.push(d.raw); finishInk(d); return; }
  if (d.type === 'lasso') { finishLasso(d, e); return; }
  if (d.type === 'erase') { if (d.n) commit(d.pre); return; }
  if (d.type === 'reconnect') {
    const e2 = find(d.eid);
    if (e2 && d.target && d.target !== e2[d.end]) {
      const nf = d.end === 'from' ? d.target : e2.from, nt = d.end === 'to' ? d.target : e2.to;
      if (doc.edges.some(x => x !== e2 && x.from === nf && x.to === nt)) { anim(d.target, 'nope', 400); toast('These two nodes are already connected in that direction'); render(); }
      else { e2[d.end] = d.target; anim(d.target, 'settle', 300); commit(d.pre); toast('Connector reconnected'); }
    } else render();
    return;
  }
  if (d.type === 'move') {
    if (d.moved && Object.keys(d.orig).length) {
      for (const id in d.orig) anim(id, 'settle', 300);
      if (physOn()) { phys.pre = phys.pre || d.pre; phys.frames = 0; physKick(); render(); } else commit(d.pre);
    }
    else if (!d.moved && d.multi) { sel = expandGroups(new Set([d.clickId])); changed(); }
  } else if (d.type === 'resize') { if (d.moved) { if (physOn() && phys.fixed.size) { phys.pre = phys.pre || d.pre; phys.frames = 0; physKick(); } else commit(d.pre); } }
  else if (d.type === 'marquee') { changed(); }
  else if (d.type === 'create') {
    const pre = snap(); let b = d.cur ? rectOf(d.start, d.cur) : null;
    if (!b || b.w * view.k < 8 || b.h * view.k < 8) { const [w, h] = DEF_SIZE[d.shape]; b = { x: d.start.x - w / 2, y: d.start.y - h / 2, w, h }; }
    else { b.w = Math.max(40, b.w); b.h = Math.max(30, b.h); }
    const n = normalize({ id: uid('n'), type: 'node', shape: d.shape, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) });
    doc.items.push(n); sel = new Set([n.id]); prevSel.add(n.id); anim(n.id, 'pop', 300); setTool('select'); commit(pre); physAfter([n.id]);
  } else if (d.type === 'connect') {
    const pre = snap(), a = find(d.from);
    if (d.target) {
      if (!doc.edges.some(x => x.from === d.from && x.to === d.target)) { const ed2 = newEdge(d.from, d.target); doc.edges.push(ed2); sel = new Set([ed2.id]); anim(ed2.id, 'draw', 360); anim(d.target, 'settle', 300); setTimeout(render, 380); commit(pre); }
      else { anim(d.target, 'nope', 400); toast('These two nodes are already connected in that direction'); render(); }
    } else if (a && d.sp && d.cur && Math.hypot(d.cur.x - d.sp.x, d.cur.y - d.sp.y) * view.k < 6) { quickAdd(a, d.side, a);
    } else if (a && d.cur && inside(d.cur, a)) { anim(a.id, 'nope', 400); render();
    } else if (d.cur && a && Math.hypot(d.cur.x - anchor(a, d.side).x, d.cur.y - anchor(a, d.side).y) > 40) {
      const [sx, sy] = SIDES[d.side];
      const n = normalize({ id: uid('n'), type: 'node', shape: a.shape, fill: a.fill, radius: a.radius, border: a.border, shadow: a.shadow, w: a.w, h: a.h, x: Math.round(d.cur.x - (sx ? (sx > 0 ? 0 : a.w) : a.w / 2)), y: Math.round(d.cur.y - (sy ? (sy > 0 ? 0 : a.h) : a.h / 2)) });
      const ne = newEdge(a.id, n.id), eid = ne.id; doc.items.push(n); doc.edges.push(ne);
      anim(n.id, 'pop', 300); anim(eid, 'draw', 360); setTimeout(render, 380);
      if (tool === 'conn') setTool('select');
      openEditor(n.id, pre);
    } else drawUI();
  } else drawUI();
}
function onUp(e) {
  clearLP();
  if (touches.has(e.pointerId)) { touches.delete(e.pointerId); if (pinch) { if (!touches.size) pinch = null; return; } }
  if (pinch) return;
  if (drag && dragPid !== null && e.pointerId !== dragPid) return;
  endDrag(e);
}
svg.addEventListener('pointerup', onUp);
svg.addEventListener('pointercancel', onUp);
svg.addEventListener('pointerleave', () => { if (!drag && hoverId) { hoverId = null; drawUI(); } });
let lastDown = null, lp = null, ctxAt = 0;
function clearLP() { if (lp) { clearTimeout(lp.t); const had = lp.ring; lp = null; if (had) drawUI(); } }
function onLongPress() {
  if (!lp) return; const L = lp;
  const d = drag;
  if (d && d.type === 'move' && !d.moved) {           // held on an object → menu
    drag = null; lp = null; showCtx(L.x, L.y); return;
  }
  if (d && (d.type === 'pan' || (d.type === 'ink' && d.pts.length < 4))) {   // held on empty → lasso
    drag = { type: 'lasso', pts: [[L.p.x, L.p.y]], menu: true, held: true, pre: null };
    sel.clear(); changed(); lp.ring = true; drawUI();
    setTimeout(() => { if (lp === L) { lp.ring = false; drawUI(); } }, 520);
    toast('Lasso: draw around what you want to select'); return;
  }
  lp = null;
}
function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi) c = !c; } return c; }
function finishLasso(d, e) {
  const P = d.pts;
  if (P.length < 3) { if (d.held || d.menu) showCtx(e.clientX, e.clientY); else changed(); return; }
  const hit = new Set();
  for (const it of doc.items) {
    if (isInk(it)) { const A = inkAbs(it); let tot = 0, inn = 0; for (const st of A.strokes) for (let i = 0; i < st.length; i += 3) { tot++; if (inPoly(st[i][0], st[i][1], P)) inn++; } if (tot && inn / tot >= .5) hit.add(it.id); continue; }
    const b = bbox(it); let c = 0;
    for (const [u, v] of [[.5, .5], [.15, .15], [.85, .15], [.15, .85], [.85, .85], [.5, .15], [.5, .85], [.15, .5], [.85, .5]]) if (inPoly(b.x + b.w * u, b.y + b.h * v, P)) c++;
    if (c >= 5 || (c && inPoly(b.x + b.w / 2, b.y + b.h / 2, P) && c >= 3)) hit.add(it.id);
  }
  sel = expandGroups(hit); changed();
  if (!sel.size) { toast('Nothing inside the lasso'); return; }
  if (tool === 'lasso' && !d.menu) setTool('select');
  if (d.menu) showCtx(e.clientX, e.clientY);
}
function showCtx(cx, cy) {
  const objs = selObjs(), items = objs.filter(o => !isEdge(o)), grouped = items.length && new Set(items.map(o => o.g || o.id)).size === 1 && items.every(o => o.g);
  const B = (c, t, kb, cls) => `<button data-c="${c}" class="${cls || ''}">${t}${kb ? `<span class="kb">${kb}</span>` : ''}</button>`;
  let h;
  if (!objs.length) h = B('paste', 'Paste', MK + ' V') + B('selall', 'Select all', MK + ' A') + '<hr>' + B('lasso', 'Lasso select', 'Q') + B('pen', 'Pen', 'B');
  else {
    h = B('copy', 'Copy', MK + ' C') + B('cut', 'Cut', MK + ' X') + (clip ? B('paste', 'Paste', MK + ' V') : '') + B('dup', 'Duplicate', MK + ' D') + '<hr>';
    if (items.length >= 2) h += grouped ? B('ungroup', 'Ungroup', MK + ' ⇧ G') : B('group', 'Group', MK + ' G');
    else if (items.some(o => o.g)) h += B('ungroup', 'Ungroup', MK + ' ⇧ G');
    h += B('brush', 'Format painter') + (styleClip ? B('pstyle', 'Paste style', MK + ' ⌥ V') : '');
    if (items.length === 1 && !isInk(items[0])) h += B('edit', 'Edit text', 'Enter');
    if (objs.length === 1 && isEdge(objs[0])) h += B('edit', objs[0].label ? 'Edit label' : 'Add label');
    h += '<hr>' + B('top', 'Bring to front') + B('bottom', 'Send to back') + B('del', 'Delete', 'Delete', 'dz');
  }
  closeMenus();
  const m = $('#ctx'); m.innerHTML = h; m.classList.add('show');
  const r = app.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(cx + 10, r.width - mw - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(cy + 10, r.height - mh - 8)) + 'px';
  ctxAt = now();
}
$('#ctx').addEventListener('click', e => {
  const b = e.target.closest('[data-c]'); if (!b) return; const c = b.dataset.c; closeMenus();
  if (c === 'copy') { if (copy()) toast('Copied'); }
  if (c === 'cut') { if (copy()) del(); }
  if (c === 'paste') paste();
  if (c === 'dup') { if (copy()) paste(); }
  if (c === 'group') groupSel();
  if (c === 'ungroup') ungroupSel();
  if (c === 'brush') startBrush();
  if (c === 'pstyle') pasteStyle();
  if (c === 'edit') { const o = selObjs()[0]; if (o) openEditor(o.id); }
  if (c === 'top' || c === 'bottom') reorder(c);
  if (c === 'del') del();
  if (c === 'selall') { sel = new Set(doc.items.map(i => i.id)); changed(); }
  if (c === 'lasso') setTool('lasso');
  if (c === 'pen') setTool('pen');
});
svg.addEventListener('contextmenu', e => {
  e.preventDefault(); if (editing) closeEditor();
  const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest('[data-id]'), id = t && t.dataset.id;
  if (id && !sel.has(id)) { sel = expandGroups(new Set([id])); changed(); }
  else if (!id && sel.size) { sel.clear(); changed(); }
  showCtx(e.clientX, e.clientY);
});
function onDouble(e, p, tgt) {
  const it = tgt && tgt.dataset.id && find(tgt.dataset.id);
  if (isInk(it)) return;
  if (it) { openEditor(it.id); return; }
  { const pre = snap(); const t = normalize({ id: uid('t'), type: 'text', x: p.x - TPX, y: p.y - TEXT_FS * LH / 2 - TPY, w: 240, text: '' }); doc.items.push(t); anim(t.id, 'pop', 300); openEditor(t.id, pre); }
}
let viewAnim = 0;
function tweenView(fn, dur = 300) {
  cancelAnimationFrame(viewAnim);
  if (RM) { fn(1); applyView(); return; }
  const t0 = now();
  const step = () => { const t = Math.min(1, (now() - t0) / dur); fn(1 - Math.pow(1 - t, 3)); applyView(); if (t < 1) viewAnim = requestAnimationFrame(step); };
  viewAnim = requestAnimationFrame(step);
}
function zoomTo(k1) {
  const r = svg.getBoundingClientRect(), sx = r.width / 2, sy = r.height / 2, v0 = { ...view };
  k1 = Math.min(4, Math.max(.1, k1)); const wx = (sx - v0.x) / v0.k, wy = (sy - v0.y) / v0.k;
  tweenView(e => { const k = v0.k + (k1 - v0.k) * e; view = { k, x: sx - wx * k, y: sy - wy * k }; }, 260);
}
function zoomAt(cx, cy, f) {
  cancelAnimationFrame(viewAnim);
  const k = Math.min(4, Math.max(.1, view.k * f)), r = svg.getBoundingClientRect(), sx = cx - r.left, sy = cy - r.top;
  view.x = sx - (sx - view.x) * k / view.k; view.y = sy - (sy - view.y) * k / view.k; view.k = k; applyView();
}
svg.addEventListener('wheel', e => {
  e.preventDefault(); cancelAnimationFrame(viewAnim);
  let dx = e.deltaX, dy = e.deltaY; if (e.deltaMode === 1) { dx *= 16; dy *= 16; } else if (e.deltaMode === 2) { dx *= 400; dy *= 400; }
  if (e.ctrlKey || e.metaKey) { zoomAt(e.clientX, e.clientY, Math.exp(-dy * .01)); return; }
  const mouse = e.deltaMode !== 0 || (dx === 0 && ((e.wheelDeltaY && Math.abs(e.wheelDeltaY) % 120 === 0) || Math.abs(dy) >= 100 && Number.isInteger(dy)));
  if (e.shiftKey) { view.x -= dx || dy; applyView(); return; }
  if (!mouse) { view.x -= dx; view.y -= dy; applyView(); return; }
  zoomAt(e.clientX, e.clientY, Math.exp(-dy * .0018));
}, { passive: false });
let gest = null;
svg.addEventListener('gesturestart', e => { e.preventDefault(); gest = { k: view.k }; });
svg.addEventListener('gesturechange', e => { e.preventDefault(); if (!gest || touches.size >= 2) return; zoomAt(e.clientX, e.clientY, (gest.k * e.scale) / view.k); });
svg.addEventListener('gestureend', e => { e.preventDefault(); gest = null; });
function fitView(smooth) {
  const r = svg.getBoundingClientRect();
  if (!doc.items.length) { view = { x: r.width / 2, y: r.height / 2, k: 1 }; applyView(); return; }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const it of doc.items) { const b = bbox(it); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  const narrow = r.width < 760, pl = narrow ? 24 : 96, pr = narrow ? 24 : (panel.classList.contains('show') ? 300 : 60), pt = 90, pb = narrow ? 150 : 90;
  const aw = Math.max(120, r.width - pl - pr), ah = Math.max(120, r.height - pt - pb);
  const k = Math.min(1.4, Math.max(.1, Math.min(aw / (x1 - x0), ah / (y1 - y0))));
  const to = { k, x: pl + aw / 2 - (x0 + x1) / 2 * k, y: pt + ah / 2 - (y0 + y1) / 2 * k };
  if (!smooth) { view = to; applyView(); return; }
  const v0 = { ...view }; tweenView(e => { view = { k: v0.k + (to.k - v0.k) * e, x: v0.x + (to.x - v0.x) * e, y: v0.y + (to.y - v0.y) * e }; }, 380);
}

// ---------- alignment guides & snapping ----------
function axisSnap(G, boxes, ax, T) {
  const P = b => ax ? b.y : b.x, S = b => ax ? b.h : b.w, C0 = b => ax ? b.x : b.y, C1 = b => ax ? b.x + b.w : b.y + b.h;
  const ov = (a, b) => C0(a) < C1(b) && C1(a) > C0(b), mc = (a, b) => (Math.max(C0(a), C0(b)) + Math.min(C1(a), C1(b))) / 2;
  let best = null;
  const g = [P(G), P(G) + S(G) / 2, P(G) + S(G)];
  for (const b of boxes) for (const ci of [P(b), P(b) + S(b) / 2, P(b) + S(b)]) for (const gi of g) { const d = ci - gi; if (Math.abs(d) < T && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, kind: 'align' }; }
  const tryC = (d, segs) => { if (Math.abs(d) < T && (!best || Math.abs(d) < Math.abs(best.d) - .01)) best = { d, kind: 'space', segs }; };
  const row = boxes.filter(b => ov(b, G));
  const A = row.filter(b => P(b) + S(b) <= P(G) + T).sort((a, b) => (P(b) + S(b)) - (P(a) + S(a)))[0];
  const B = row.filter(b => P(b) >= P(G) + S(G) - T).sort((a, b) => P(a) - P(b))[0];
  if (A) { const A2 = boxes.filter(b => b !== A && ov(b, A) && P(b) + S(b) <= P(A)).sort((a, b) => (P(b) + S(b)) - (P(a) + S(a)))[0];
    if (A2) { const gap = P(A) - P(A2) - S(A2); tryC(P(A) + S(A) + gap - P(G), [[P(A2) + S(A2), P(A), mc(A2, A)], [P(A) + S(A), P(A) + S(A) + gap, mc(A, G)]]); } }
  if (B) { const B2 = boxes.filter(b => b !== B && ov(b, B) && P(b) >= P(B) + S(B)).sort((a, b) => P(a) - P(b))[0];
    if (B2) { const gap = P(B2) - P(B) - S(B); tryC(P(B) - gap - S(G) - P(G), [[P(B) + S(B), P(B2), mc(B, B2)], [P(B) - gap, P(B), mc(B, G)]]); } }
  if (A && B) { const free = P(B) - P(A) - S(A) - S(G); if (free > 0) { const gap = free / 2; tryC(P(A) + S(A) + gap - P(G), [[P(A) + S(A), P(A) + S(A) + gap, mc(A, G)], [P(B) - gap, P(B), mc(B, G)]]); } }
  return best;
}
function snapMove(dx, dy, off) {
  if (off) return { dx, dy, guides: null };
  const T = 7 / view.k, mv = drag.orig, boxes = doc.items.filter(o => !(o.id in mv)).map(bbox);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id in mv) { const b = bbox(find(id)), x = mv[id].x + dx, y = mv[id].y + dy; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + b.w); y1 = Math.max(y1, y + b.h); }
  if (x0 === Infinity) return { dx, dy, guides: null };
  const G = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  const sx = axisSnap(G, boxes, 0, T), sy = axisSnap(G, boxes, 1, T);
  if (sx) { dx += sx.d; G.x += sx.d; } if (sy) { dy += sy.d; G.y += sy.d; }
  const lines = [], spaces = [], near = (a, b) => Math.abs(a - b) < 1;
  if (sx && sx.kind === 'align') for (const v of [G.x, G.x + G.w / 2, G.x + G.w]) for (const b of boxes) if ([b.x, b.x + b.w / 2, b.x + b.w].some(c => near(c, v))) lines.push({ x1: v, y1: Math.min(G.y, b.y) - 8, x2: v, y2: Math.max(G.y + G.h, b.y + b.h) + 8 });
  if (sy && sy.kind === 'align') for (const v of [G.y, G.y + G.h / 2, G.y + G.h]) for (const b of boxes) if ([b.y, b.y + b.h / 2, b.y + b.h].some(c => near(c, v))) lines.push({ x1: Math.min(G.x, b.x) - 8, y1: v, x2: Math.max(G.x + G.w, b.x + b.w) + 8, y2: v });
  if (sx && sx.kind === 'space') sx.segs.forEach(([a, b, c]) => spaces.push({ x1: a, y1: c, x2: b, y2: c }));
  if (sy && sy.kind === 'space') sy.segs.forEach(([a, b, c]) => spaces.push({ x1: c, y1: a, x2: c, y2: b }));
  return { dx, dy, guides: { lines, spaces } };
}

// ---------- quick extend ----------
function flowSide(a) {
  const pe = doc.edges.find(e => e.to === a.id), p = pe && find(pe.from); if (!p) return 'r';
  const dx = (a.x + a.w / 2) - (p.x + p.w / 2), dy = (a.y + a.h / 2) - (p.y + p.h / 2);
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'r' : 'l') : (dy >= 0 ? 'b' : 't');
}
function quickAdd(base, side, parent, gap = 80) {
  if (!base) return;
  const pre = snap(), [sx, sy] = SIDES[side], w = base.w, h = base.h;
  const free = (x, y) => !doc.items.some(o => isNode(o) && x < o.x + o.w + 16 && x + w + 16 > o.x && y < o.y + o.h + 16 && y + h + 16 > o.y);
  const bx = base.x + sx * (w + gap), by = base.y + sy * (h + gap); let x = bx, y = by;
  for (let i = 1; i < 16 && !free(x, y); i++) { const o = (i % 2 ? 1 : -1) * Math.ceil(i / 2); if (sx) y = by + o * (h + 36); else x = bx + o * (w + 36); }
  const n = normalize({ id: uid('n'), type: 'node', shape: base.shape, fill: base.fill, radius: base.radius, border: base.border, shadow: base.shadow, fs: base.fs, fit: base.fit, color: base.color, w, h, x: Math.round(x), y: Math.round(y) });
  doc.items.push(n); anim(n.id, 'pop', 300);
  if (parent) { const ne = newEdge(parent.id, n.id); doc.edges.push(ne); anim(ne.id, 'draw', 360); setTimeout(render, 380); }
  openEditor(n.id, pre); ensureVisible(n);
}
function addSibling(a) {
  const pe = doc.edges.find(e => e.to === a.id), p = pe && find(pe.from), f = flowSide(a);
  quickAdd(a, f === 'r' || f === 'l' ? 'b' : 'r', p || null, 40);
}
function ensureVisible(b) {
  const r = svg.getBoundingClientRect(), k = view.k, m = 80, pr = panel.classList.contains('show') ? 290 : m;
  const sx0 = view.x + b.x * k, sy0 = view.y + b.y * k, sx1 = sx0 + b.w * k, sy1 = sy0 + b.h * k;
  let dx = 0, dy = 0;
  if (sx1 > r.width - pr) dx = r.width - pr - sx1; if (sx0 + dx < m) dx = m - sx0;
  if (sy1 > r.height - m) dy = r.height - m - sy1; if (sy0 + dy < m) dy = m - sy0;
  if (dx || dy) { const v0 = { ...view }; tweenView(e => { view = { k: v0.k, x: v0.x + dx * e, y: v0.y + dy * e }; }, 300); }
}
function stepFs(dir) {
  const objs = selObjs().filter(o => !isEdge(o)); if (!objs.length) return;
  mutate(() => objs.forEach(o => { const c = defFs(o); o.fs = dir > 0 ? (FS_STEPS.find(v => v > c) || c) : ([...FS_STEPS].reverse().find(v => v < c) || c); fitNode(o); }));
}

// ---------- physics ----------
const phys = { raf: 0, pre: null, fixed: new Set(), frames: 0 };
const physOn = () => !!(doc.phys && doc.phys.on);
function physStep() {
  const P = doc.phys, gap = +P.gap, kk = .08 + .4 * P.strength / 100;
  const bodies = doc.items.filter(isNode).map(n => ({ o: n, fixed: n.locked || phys.fixed.has(n.id) }));
  for (const t of doc.items) if (isText(t) && t.avoid) bodies.push({ o: bbox(t), fixed: true });
  const disp = new Map(); let moved = 0;
  const add = (b, x, y) => { const d = disp.get(b) || { x: 0, y: 0 }; d.x += x; d.y += y; disp.set(b, d); };
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const A = bodies[i], B = bodies[j]; if (A.fixed && B.fixed) continue;
    const a = A.o, b = B.o, dx = (b.x + b.w / 2) - (a.x + a.w / 2), dy = (b.y + b.h / 2) - (a.y + a.h / 2);
    const ox = (a.w + b.w) / 2 + gap - Math.abs(dx), oy = (a.h + b.h) / 2 + gap - Math.abs(dy);
    if (ox <= 0 || oy <= 0) continue;
    let vx = 0, vy = 0;
    if (ox < oy) vx = (dx >= 0 ? 1 : -1) * ox; else vy = (dy >= 0 ? 1 : -1) * oy;
    if (A.fixed) add(B, vx, vy); else if (B.fixed) add(A, -vx, -vy); else { add(A, -vx / 2, -vy / 2); add(B, vx / 2, vy / 2); }
  }
  for (const [b, d] of disp) { const mx = d.x * kk, my = d.y * kk; b.o.x += mx; b.o.y += my; moved += Math.abs(mx) + Math.abs(my); }
  return moved;
}
function physLoop() {
  phys.raf = 0;
  const m = physStep(); draw();
  const live = drag && (drag.type === 'move' || drag.type === 'resize');
  if (live || (m > .25 && ++phys.frames < 600)) phys.raf = requestAnimationFrame(physLoop);
  else physDone();
}
function physKick() { if (physOn() && !phys.raf) phys.raf = requestAnimationFrame(physLoop); }
function physDone() {
  for (const n of doc.items) if (isNode(n)) { n.x = Math.round(n.x); n.y = Math.round(n.y); }
  phys.fixed.clear(); phys.frames = 0;
  if (phys.pre) { const pre = phys.pre; phys.pre = null; if (pre !== snap()) commit(pre); else changed(); }
  else changed();
}
function physAfter(ids, pre) { if (!physOn()) return; phys.pre = phys.pre || pre || snap(); for (const id of ids) phys.fixed.add(id); phys.frames = 0; physKick(); }
function physStop() { cancelAnimationFrame(phys.raf); phys.raf = 0; phys.pre = null; phys.fixed.clear(); phys.frames = 0; }
function togglePhys() {
  doc.phys.on = !doc.phys.on; renderPhys(); scheduleSave();
  if (doc.phys.on) { physAfter([]); toast('Elastic mode on: overlapping nodes move apart'); }
  else { if (phys.raf) { cancelAnimationFrame(phys.raf); phys.raf = 0; physDone(); } toast('Free mode: nodes can overlap'); }
}
function renderPhys() {
  const P = doc.phys;
  $('#bPhys').classList.toggle('on', P.on);
  $('#pPhys').innerHTML = `<h4>Physics</h4>${tgl('phys', P.on, 'Elastic mode')}
  <p class="note">${P.on ? 'Nodes that get too close or overlap glide apart. The node you drag follows the pointer; locked nodes never move.' : 'Free mode: nodes can overlap freely and nothing else moves.'}</p>
  <div class="row" style="margin:14px 0 10px"><div class="lab">Strength<span id="pvS">${P.strength}</span></div><input type="range" min="0" max="100" data-p="strength" value="${P.strength}"></div>
  <div class="row" style="margin:0"><div class="lab">Spacing<span id="pvG">${P.gap} px</span></div><input type="range" min="0" max="60" data-p="gap" value="${P.gap}"></div>`;
  syncRanges($('#pPhys'));
}
$('#pPhys').addEventListener('click', e => { if (e.target.closest('[data-act=phys]')) togglePhys(); });
$('#pPhys').addEventListener('input', e => {
  const k2 = e.target.dataset.p; if (!k2) return;
  doc.phys[k2] = +e.target.value;
  $('#pvS').textContent = doc.phys.strength; $('#pvG').textContent = doc.phys.gap + ' px';
  scheduleSave(); if (k2 === 'gap') physAfter([]);
});

// ---------- auto layout ----------
let layoutBusy = false;
function autoLayout(dir) {
  closeMenus(); if (editing) closeEditor(); if (layoutBusy) return;
  let nodes = selObjs().filter(isNode); if (nodes.length < 2) nodes = doc.items.filter(isNode);
  const whole = nodes.length === doc.items.filter(isNode).length;
  nodes = nodes.filter(n => !n.locked);
  if (nodes.length < 2) { toast('Need at least two movable nodes'); return; }
  const LR = dir === 'LR', ids = new Set(nodes.map(n => n.id)), byId = new Map(nodes.map(n => [n.id, n]));
  const E = doc.edges.filter(e => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  const linked = new Set(); E.forEach(e => { linked.add(e.from); linked.add(e.to); });
  const main = n => LR ? n.w : n.h, cross = n => LR ? n.h : n.w, pM = n => LR ? n.x : n.y, pC = n => LR ? n.y : n.x;
  const G = nodes.filter(n => linked.has(n.id)), iso = nodes.filter(n => !linked.has(n.id));
  // 1. break cycles (DFS, drop back edges)
  const adj = new Map(G.map(n => [n.id, []])), indeg0 = new Map(G.map(n => [n.id, 0]));
  E.forEach(e => { adj.get(e.from).push(e); indeg0.set(e.to, indeg0.get(e.to) + 1); });
  const st = new Map(), keep = [];
  const dfs = u => { st.set(u, 1); for (const e of adj.get(u)) { const s2 = st.get(e.to); if (s2 === 1) continue; keep.push(e); if (!s2) dfs(e.to); } st.set(u, 2); };
  [...G].sort((a, b) => (indeg0.get(a.id) - indeg0.get(b.id)) || (pM(a) - pM(b)) || (pC(a) - pC(b))).forEach(n => { if (!st.get(n.id)) dfs(n.id); });
  // 2. layers by longest path
  const preds = new Map(G.map(n => [n.id, []])), succs = new Map(G.map(n => [n.id, []]));
  keep.forEach(e => { preds.get(e.to).push(e.from); succs.get(e.from).push(e.to); });
  const layer = new Map(), indeg = new Map(G.map(n => [n.id, preds.get(n.id).length]));
  const q = G.filter(n => !indeg.get(n.id)).map(n => n.id); q.forEach(id => layer.set(id, 0));
  while (q.length) { const u = q.shift(); for (const v of succs.get(u)) { layer.set(v, Math.max(layer.get(v) || 0, layer.get(u) + 1)); indeg.set(v, indeg.get(v) - 1); if (!indeg.get(v)) q.push(v); } }
  const L = []; G.forEach(n => { const l = layer.get(n.id) || 0; (L[l] = L[l] || []).push(n.id); });
  for (let i = 0; i < L.length; i++) L[i] = L[i] || [];
  // 3. order within layers (barycenter sweeps)
  L.forEach(a => a.sort((x, y) => pC(byId.get(x)) - pC(byId.get(y))));
  const m = new Map(); L.forEach(a => a.forEach((id, i) => m.set(id, i)));
  for (let it = 0; it < 8; it++) {
    const down = it % 2 === 0, seq = down ? L.slice(1) : L.slice(0, -1).reverse();
    for (const a of seq) {
      const key = new Map(a.map(id => { const nb = down ? preds.get(id) : succs.get(id); return [id, nb.length ? nb.reduce((s2, x) => s2 + m.get(x), 0) / nb.length : m.get(id)]; }));
      a.sort((x, y) => key.get(x) - key.get(y)); a.forEach((id, i) => m.set(id, i));
    }
  }
  // 4. coordinates
  const GM = LR ? 110 : 90, GC = 48, P = new Map(); let mpos = 0;
  for (const a of L) {
    if (!a.length) continue;
    const lm = Math.max(...a.map(id => main(byId.get(id))));
    const want = a.map(id => { const pr = preds.get(id).filter(x => P.has(x)); return pr.length ? pr.reduce((s2, x) => s2 + P.get(x).c + cross(byId.get(x)) / 2, 0) / pr.length - cross(byId.get(id)) / 2 : null; });
    let c = 0; const pack = a.map(id => { const v = c; c += cross(byId.get(id)) + GC; return v; });
    const tot = c - GC; pack.forEach((v, i) => pack[i] = v - tot / 2);
    const des = a.map((id, i) => want[i] ?? pack[i]);
    for (let i = 1; i < des.length; i++) des[i] = Math.max(des[i], des[i - 1] + cross(byId.get(a[i - 1])) + GC);
    const shift = a.reduce((s2, id, i) => s2 + ((want[i] ?? des[i]) - des[i]), 0) / a.length;
    a.forEach((id, i) => P.set(id, { m: mpos + (lm - main(byId.get(id))) / 2, c: des[i] + shift }));
    mpos += lm + GM;
  }
  let cmax = 0; for (const [id, p2] of P) cmax = Math.max(cmax, p2.c + cross(byId.get(id)));
  let mm = 0; const c0 = P.size ? cmax + 80 : 0;
  iso.sort((a, b) => (pM(a) - pM(b)) || (pC(a) - pC(b))).forEach(n => { P.set(n.id, { m: mm, c: c0 }); mm += main(n) + 40; });
  const target = new Map(); let minX = Infinity, minY = Infinity;
  for (const [id, p2] of P) { const x = LR ? p2.m : p2.c, y = LR ? p2.c : p2.m; target.set(id, { x, y }); minX = Math.min(minX, x); minY = Math.min(minY, y); }
  const ox = Math.min(...nodes.map(n => n.x)), oy = Math.min(...nodes.map(n => n.y));
  for (const t of target.values()) { t.x = Math.round(t.x - minX + ox); t.y = Math.round(t.y - minY + oy); }
  // 5. animate, then one undo step
  physStop();
  const pre = snap(), from = new Map(nodes.map(n => [n.id, { x: n.x, y: n.y }])), t0 = now(), dur = RM ? 0 : 560;
  layoutBusy = true;
  const step = () => {
    const t = dur ? Math.min(1, (now() - t0) / dur) : 1, e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    for (const [id, f] of from) { const n = byId.get(id), to = target.get(id); n.x = f.x + (to.x - f.x) * e; n.y = f.y + (to.y - f.y) * e; }
    draw();
    if (t < 1) { requestAnimationFrame(step); return; }
    for (const n of nodes) { n.x = Math.round(n.x); n.y = Math.round(n.y); }
    layoutBusy = false; commit(pre); physAfter([...ids]);
    if (whole) fitView(true);
    toast(`Arranged ${nodes.length} nodes ${LR ? 'left to right' : 'top to bottom'} · undo to revert`);
  };
  requestAnimationFrame(step);
}
document.querySelectorAll('[data-lay]').forEach(b => b.addEventListener('click', () => autoLayout(b.dataset.lay)));

// ---------- selection ops ----------
const selObjs = () => [...sel].map(find).filter(Boolean);
function mutate(fn) { const pre = snap(); fn(); commit(pre); }
function del() {
  if (!sel.size) return;
  if (!RM) {
    const t0 = now(), ids = new Set(sel), gone = id => ids.has(id) && !find(id).locked;
    for (const e of doc.edges) if (ids.has(e.id) || gone(e.from) || gone(e.to)) ghosts.push({ html: edgeSVG(e, true), t0 });
    for (const it of doc.items) if (gone(it.id)) ghosts.push({ html: isNode(it) ? nodeSVG(it, true) : isInk(it) ? inkSVG(it, true) : textItemSVG(it, true), t0 });
    setTimeout(render, 250);
  }
  mutate(() => {
    const ids = new Set(sel);
    doc.items = doc.items.filter(i => !ids.has(i.id) || i.locked);
    doc.edges = doc.edges.filter(e => !ids.has(e.id) && find(e.from) && find(e.to));
    sel = new Set([...sel].filter(id => find(id)));
  });
}
function copy() {
  const items = selObjs().filter(o => !isEdge(o)); if (!items.length) return false;
  const ids = new Set(items.map(i => i.id));
  clip = JSON.stringify({ items, edges: doc.edges.filter(e => ids.has(e.from) && ids.has(e.to)) }); pasteN = 0;
  try { localStorage.setItem('flowspace.clip', clip); } catch (e) { }
  return true;
}
function paste() {
  let c = clip; if (!c) try { c = localStorage.getItem('flowspace.clip'); } catch (e) { }
  if (!c) return; const o = JSON.parse(c); pasteN++;
  mutate(() => {
    const map = {}, gmap = {}, off = 24 * pasteN; sel = new Set();
    for (const it of o.items) { const n = { ...it, id: uid(it.type === 'text' ? 't' : it.type === 'ink' ? 'k' : 'n'), x: it.x + off, y: it.y + off, locked: false }; if (it.g) n.g = gmap[it.g] || (gmap[it.g] = uid('g')); map[it.id] = n.id; doc.items.push(n); sel.add(n.id); prevSel.add(n.id); anim(n.id, 'pop', 300); }
    for (const e of o.edges) { const id = uid('e'); doc.edges.push({ ...e, id, from: map[e.from], to: map[e.to] }); anim(id, 'draw', 360); }
    setTimeout(render, 380);
  });
  physAfter([...sel]);
}
function pasteText(t) {
  const r = svg.getBoundingClientRect(), c = { x: (r.width / 2 - view.x) / view.k, y: (r.height / 2 - view.y) / view.k };
  mutate(() => { const it = normalize({ id: uid('t'), type: 'text', x: Math.round(c.x - 160), y: Math.round(c.y - 20), w: 320, text: t }); doc.items.push(it); sel = new Set([it.id]); prevSel.add(it.id); anim(it.id, 'pop', 300); });
  toast('Pasted as a text box');
}
function expandGroups(set) {
  const gs = new Set(); for (const id of set) { const o = find(id); if (o && o.g) gs.add(o.g); }
  if (gs.size) for (const it of doc.items) if (it.g && gs.has(it.g)) set.add(it.id);
  return set;
}
function groupSel() {
  const objs = selObjs().filter(o => !isEdge(o)); if (objs.length < 2) { toast('Select at least 2 objects to group'); return; }
  const gid = uid('g'); mutate(() => objs.forEach(o => o.g = gid)); toast(`Grouped ${objs.length} objects`);
}
function ungroupSel() {
  const objs = selObjs().filter(o => o.g); if (!objs.length) { toast('Nothing in the selection is grouped'); return; }
  mutate(() => objs.forEach(o => { delete o.g; })); toast('Ungrouped');
}
function arrange(kind) {
  const m = new Map();
  for (const o of selObjs().filter(o => !isEdge(o))) { const key = o.g || o.id; if (!m.has(key)) m.set(key, []); m.get(key).push(o); }
  const U = [...m.values()].map(list => ({ list, b: unionBox(list.map(bbox)), locked: list.some(o => o.locked) }));
  const dist = kind === 'dh' || kind === 'dv';
  if (U.length < (dist ? 3 : 2)) { toast(dist ? 'Distribute needs at least 3 objects' : 'Select at least 2 objects'); return; }
  const A = unionBox(U.map(u => u.b));
  mutate(() => {
    const mv = (u, dx, dy) => { if (u.locked || (!dx && !dy)) return; u.list.forEach(o => { o.x = Math.round(o.x + dx); o.y = Math.round(o.y + dy); anim(o.id, 'settle', 300); }); };
    for (const u of U) {
      if (kind === 'l') mv(u, A.x - u.b.x, 0);
      if (kind === 'ch') mv(u, A.x + A.w / 2 - (u.b.x + u.b.w / 2), 0);
      if (kind === 'r') mv(u, A.x + A.w - (u.b.x + u.b.w), 0);
      if (kind === 't') mv(u, 0, A.y - u.b.y);
      if (kind === 'cv') mv(u, 0, A.y + A.h / 2 - (u.b.y + u.b.h / 2));
      if (kind === 'b') mv(u, 0, A.y + A.h - (u.b.y + u.b.h));
    }
    if (dist) {
      const H = kind === 'dh', P = b => H ? b.x : b.y, S = b => H ? b.w : b.h;
      const s2 = [...U].sort((a, b) => (P(a.b) + S(a.b) / 2) - (P(b.b) + S(b.b) / 2));
      const span = P(s2[s2.length - 1].b) + S(s2[s2.length - 1].b) - P(s2[0].b), sum = s2.reduce((t, u) => t + S(u.b), 0), gap = (span - sum) / (s2.length - 1);
      let pos = P(s2[0].b);
      for (const u of s2) { const d = pos - P(u.b); H ? mv(u, d, 0) : mv(u, 0, d); pos += S(u.b) + gap; }
    }
  });
}
const STYLE_KEYS = { node: ['shape', 'fill', 'border', 'shadow', 'radius', 'color', 'bold', 'fs', 'align', 'valign', 'fit'], text: ['color', 'bold', 'fs', 'align'], ink: ['color', 'sw', 'pen'], edge: ['style', 'arrow'] };
const kindOf = o => isEdge(o) ? 'edge' : o.type;
function copyStyle() {
  const o = selObjs()[0]; if (!o) return false; const k = kindOf(o);
  styleClip = { kind: k, v: Object.fromEntries(STYLE_KEYS[k].filter(x => o[x] !== undefined).map(x => [x, o[x]])) }; return true;
}
function applyStyleTo(o) {
  if (!styleClip || !o) return false;
  const k = kindOf(o), src = styleClip;
  const keys = src.kind === k ? STYLE_KEYS[k] : (['node', 'text'].includes(k) && ['node', 'text'].includes(src.kind)) ? STYLE_KEYS.text : (src.v.color && k !== 'edge') ? ['color'] : null;
  if (!keys) return false;
  for (const x of keys) if (src.v[x] !== undefined) o[x] = src.v[x];
  fitNode(o); return true;
}
function pasteStyle() {
  if (!styleClip) { toast('Copy a style first'); return; }
  const objs = selObjs(); if (!objs.length) return;
  mutate(() => objs.forEach(applyStyleTo)); toast('Style pasted');
}
function startBrush() { if (!copyStyle()) return; painter = true; app.classList.add('painter'); toast('Format painter: click an object to apply · Esc to cancel'); }
function stopBrush() { painter = false; app.classList.remove('painter'); }
function reorder(how) {
  mutate(() => {
    const arr = doc.items, s = it => sel.has(it.id);
    if (how === 'top') doc.items = [...arr.filter(i => !s(i)), ...arr.filter(s)];
    else if (how === 'bottom') doc.items = [...arr.filter(s), ...arr.filter(i => !s(i))];
    else {
      const a = [...arr], dir = how === 'up' ? 1 : -1, idx = a.map((it, i) => s(it) ? i : -1).filter(i => i >= 0);
      if (dir > 0) idx.reverse();
      for (const i of idx) { let j = i + dir; while (j >= 0 && j < a.length && a[j].type !== a[i].type) j += dir; if (j >= 0 && j < a.length && !s(a[j])) { [a[i], a[j]] = [a[j], a[i]]; } }
      doc.items = a;
    }
  });
}

// ---------- property panel ----------
const SHAPE_ICONS = { rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>', roundrect: '<rect x="4" y="6" width="16" height="12" rx="4"/>', circle: '<circle cx="12" cy="12" r="7.5"/>', diamond: '<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"/>', capsule: '<rect x="3" y="8" width="18" height="8" rx="4"/>' };
const AL = { left: '<path d="M5 7h14M5 12h9M5 17h12"/>', center: '<path d="M5 7h14M7.5 12h9M6 17h12"/>', right: '<path d="M5 7h14M10 12h9M7 17h12"/>' };
const VAL = { top: '<path d="M5 5h14M12 9v10M8.5 12.5L12 9l3.5 3.5"/>', middle: '<path d="M5 12h14M12 4v5M12 15v5M9 6.5L12 9l3-2.5M9 17.5l3-2.5 3 2.5"/>', bottom: '<path d="M5 19h14M12 5v10M8.5 11.5L12 15l3.5-3.5"/>' };
const same = (arr, k) => arr.length && arr.every(o => o[k] === arr[0][k]) ? arr[0][k] : undefined;
const tgl = (act, on, label) => `<div class="tg ${on ? 'on' : ''}" data-act="${act}"><span>${label}</span><i></i></div>`;
function textRows(objs) {
  const c = same(objs, 'color'), b = same(objs, 'bold'), al = same(objs, 'align'), fsv = same(objs.map(o => ({ v: defFs(o) })), 'v');
  const cn = c === undefined ? undefined : (isAutoInk(c) ? 'auto' : c), TC = ['auto', ...C.tcs];
  return `<div class="row"><div class="lab">Font size<span>${fsv ? fsv + ' px' : 'Mixed'}</span></div><div class="seg fs">${FS_PRESETS.map(v => `<button data-act="fs" data-v="${v}" class="${fsv === v ? 'on' : ''}">${v}</button>`).join('')}</div>
  <label class="num" style="margin-top:8px"><span>Custom</span><input type="number" data-act="fsc" min="8" max="200" value="${fsv ?? ''}" placeholder="8 – 200"></label></div>
  <div class="row"><div class="lab">Text color</div><div class="sws">${TC.map(x => `<button class="sw c ${cn === x ? 'on' : ''}" data-act="color" data-v="${x}" style="background:${x === 'auto' ? C.ink : x}" title="${x === 'auto' ? 'Auto (follows theme)' : x}"></button>`).join('')}<input type="color" data-act="colorc" value="${c && c[0] === '#' && c !== INK ? c : C.ink}" title="Custom color"></div></div>
  <div class="row"><div class="lab">Text</div><div class="seg"><button data-act="bold" class="${b ? 'on' : ''}" style="font-weight:700">B Bold</button>${Object.keys(AL).map(k => `<button data-act="align" data-v="${k}" class="${al === k ? 'on' : ''}" title="${{ left: 'Align left', center: 'Center', right: 'Align right' }[k]}"><svg viewBox="0 0 24 24">${AL[k]}</svg></button>`).join('')}</div></div>`;
}
const AR_IC = { l: '<path d="M5 4v16M8 7h11v4H8zM8 13h7v4H8z"/>', ch: '<path d="M12 4v16M6 7h12v4H6zM8.5 13h7v4h-7z"/>', r: '<path d="M19 4v16M5 7h11v4H5zM9 13h7v4H9z"/>', t: '<path d="M4 5h16M7 8h4v11H7zM13 8h4v7h-4z"/>', cv: '<path d="M4 12h16M7 6h4v12H7zM13 8.5h4v7h-4z"/>', b: '<path d="M4 19h16M7 5h4v11H7zM13 9h4v7h-4z"/>', dh: '<path d="M4 5v14M20 5v14M8.5 8h2.5v8H8.5zM13 8h2.5v8H13z"/>', dv: '<path d="M5 4h14M5 20h14M8 8.5h8V11H8zM8 13h8v2.5H8z"/>' };
const AR_T = { l: 'Align left  Alt A', ch: 'Center horizontally  Alt H', r: 'Align right  Alt D', t: 'Align top  Alt W', cv: 'Center vertically  Alt V', b: 'Align bottom  Alt S', dh: 'Distribute horizontally  Alt Shift H', dv: 'Distribute vertically  Alt Shift V' };
function arrangeRow(objs) {
  const items = objs.filter(o => !isEdge(o)); if (items.length < 2) return items.some(o => o.g) ? `<div class="row"><button class="btn2" data-act="ungrp">Ungroup<small style="margin-left:6px;color:var(--ink2)">${MK} Shift G</small></button></div>` : '';
  const units = new Set(items.map(o => o.g || o.id)).size, allOneGroup = units === 1;
  return `<div class="row"><div class="lab">Arrange</div><div class="seg ar">${['l', 'ch', 'r', 't', 'cv', 'b'].map(k2 => `<button data-act="ar" data-v="${k2}" title="${AR_T[k2]}" ${units < 2 ? 'disabled' : ''}><svg viewBox="0 0 24 24">${AR_IC[k2]}</svg></button>`).join('')}</div>
  <div class="seg ar" style="margin-top:6px">${['dh', 'dv'].map(k2 => `<button data-act="ar" data-v="${k2}" title="${AR_T[k2]}" ${units < 3 ? 'disabled' : ''}><svg viewBox="0 0 24 24">${AR_IC[k2]}</svg></button>`).join('')}
  ${allOneGroup ? `<button data-act="ungrp" title="${MK} Shift G" style="flex:2">Ungroup</button>` : `<button data-act="grp" title="${MK} G" style="flex:2">Group</button>`}</div></div>`;
}
const styleRow = () => `<div class="row"><div class="lab">Style</div><div class="seg"><button data-act="brush" title="Format painter: copy this style, then click a target">Painter</button><button data-act="stcopy" title="Copy style  ${MK} Alt C">Copy</button><button data-act="stpaste" title="Paste style  ${MK} Alt V" ${styleClip ? '' : 'disabled'}>Paste</button></div></div>`;
const PEN_SIZES = [[2, 'Fine'], [4, 'Medium'], [8, 'Bold']];
const inkColors = () => ['auto', ...C.tcs.filter(c => c !== '#FFFFFF'), C.selStrong, C.f.deep[1]].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);
function penPanel() {
  return `<h4>Pen</h4><div class="row"><div class="lab">Color</div><div class="sws">${inkColors().map(x => `<button class="sw c ${penPref.color === x ? 'on' : ''}" data-act="pcolor" data-v="${x}" style="background:${x === 'auto' ? C.ink : x}" title="${x === 'auto' ? 'Auto (follows theme)' : x}"></button>`).join('')}<input type="color" data-act="pcolorc" value="${penPref.color[0] === '#' ? penPref.color : C.ink}"></div></div>
  <div class="row"><div class="lab">Nib</div><div class="seg">${PEN_STYLES.map(([v, t]) => `<button data-act="pstyle" data-v="${v}" class="${penPref.style === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <div class="row"><div class="lab">Thickness</div><div class="seg">${PEN_SIZES.map(([v, t]) => `<button data-act="psize" data-v="${v}" class="${penPref.sw === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <p class="note">Fountain: more pressure, thicker line, with a tapered tail on quick flicks. Calligraphy: angled nib — thin horizontals, bold verticals. With a mouse, speed sets the weight. Press and hold, then drag, to lasso.</p>
  <p class="note">Write directly with Apple Pencil; fingers pan and pinch-zoom. Strokes written in quick succession merge into one handwriting object. The Pencil’s eraser end erases.</p>`;
}
function layerRow() { return `<div class="row"><div class="lab">Layer</div><div class="seg"><button data-act="z" data-v="top">Front</button><button data-act="z" data-v="up">Forward</button><button data-act="z" data-v="down">Backward</button><button data-act="z" data-v="bottom">Back</button></div></div>`; }
function renderPanel() {
  const objs = selObjs();
  if (!objs.length) { if (tool === 'pen') { panel.classList.add('show'); panel.innerHTML = penPanel(); return; } panel.classList.remove('show'); return; }
  panel.classList.add('show');
  const nodes = objs.filter(isNode), texts = objs.filter(isText), edges = objs.filter(isEdge), inks = objs.filter(isInk);
  let h = '';
  if (inks.length && inks.length === objs.length) {
    const c = same(inks, 'color'), cn = c === undefined ? undefined : (isAutoInk(c) ? 'auto' : c);
    h = `<h4>${inks.length === 1 ? 'Handwriting' : `${inks.length} handwriting objects`}</h4>
    <div class="row"><div class="lab">Color</div><div class="sws">${inkColors().map(x => `<button class="sw c ${cn === x ? 'on' : ''}" data-act="color" data-v="${x}" style="background:${x === 'auto' ? C.ink : x}"></button>`).join('')}<input type="color" data-act="colorc" value="${c && c[0] === '#' ? c : C.ink}"></div></div>
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
      ${((THEMES[doc.theme] || THEMES.mist).order).map(k2 => `<button class="sw ${fill === k2 ? 'on' : ''}" data-act="fill" data-v="${k2}" style="background:linear-gradient(135deg,${C.f[k2][0]},${C.f[k2][1]})" title="${FILL_NAMES[k2]} (follows theme)"></button>`).join('')}
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
  panel.innerHTML = h; syncRanges(panel);
}
function syncRanges(root) { (root || document).querySelectorAll('input[type=range]').forEach(r => r.style.setProperty('--p', ((r.value - r.min) / ((r.max - r.min) || 1) * 100) + '%')); }
document.addEventListener('input', e => { if (e.target.type === 'range') syncRanges(e.target.parentNode); });
function renderPanelNums() { const o = selObjs()[0]; if (!o) return; const w = panel.querySelector('[data-act=w],[data-act=tw]'), hh = panel.querySelector('[data-act=h]'); if (w) w.value = o.w; if (hh) hh.value = o.h; }
function applyAll(fn, filter = o => !isEdge(o)) { for (const o of selObjs()) if (filter(o)) fn(o); }
panel.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT') return;
  const a = b.dataset.act, v = b.dataset.v;
  if (a === 'del') return del();
  if (a === 'z') return reorder(v);
  if (a === 'ar') return arrange(v);
  if (a === 'grp') return groupSel();
  if (a === 'ungrp') return ungroupSel();
  if (a === 'brush') return startBrush();
  if (a === 'stcopy') { if (copyStyle()) { toast('Style copied'); renderPanel(); } return; }
  if (a === 'stpaste') return pasteStyle();
  if (a === 'pcolor') { penPref.color = v; savePrefs(); renderPanel(); return; }
  if (a === 'psize') { penPref.sw = +v; savePrefs(); renderPanel(); return; }
  if (a === 'pstyle') { penPref.style = v; savePrefs(); renderPanel(); return; }
  if (a === 'istyle') return mutate(() => applyAll(o => { o.pen = v; }, isInk));
  if (a === 'isize') return mutate(() => applyAll(o => { o.sw = +v / (inkAbs(o).s || 1); }, isInk));
  if (a === 'reverse') return mutate(() => applyAll(x => { [x.from, x.to] = [x.to, x.from]; }, isEdge));
  if (a === 'elabel') { const ee = selObjs().find(isEdge); if (ee) openEditor(ee.id); return; }
  if (a === 'estyle' || a === 'earrow') { mutate(() => applyAll(x => { if (a === 'estyle') x.style = v; else x.arrow = v; }, isEdge)); doc.edgeDef[a === 'estyle' ? 'style' : 'arrow'] = v; scheduleSave(); return; }
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
  if (a === 'avoid') { physAfter([]); if (!physOn() && selObjs().some(o => o.avoid)) toast('Turn on elastic mode to keep nodes away from this text'); }
  if (editing) { const it = find(editing); if (it && !isEdge(it)) Object.assign(ed.style, { color: tc(it), fontWeight: it.bold ? 700 : 400, textAlign: it.align, fontSize: defFs(it) + 'px' }); placeEditor(); ed.focus(); }
});
panel.addEventListener('input', e => {
  const i = e.target, a = i.dataset.act; if (!a) return;
  if (!livePre) livePre = snap();
  if (a === 'radius') { applyAll(o => o.radius = +i.value, isNode); const rv = $('#rv'); if (rv) rv.textContent = i.value; }
  if (a === 'fillc') applyAll(o => o.fill = i.value, isNode);
  if (a === 'colorc') applyAll(o => o.color = i.value);
  if (a === 'pcolorc') { penPref.color = i.value; savePrefs(); livePre = null; return; }
  render();
});
panel.addEventListener('change', e => {
  const i = e.target, a = i.dataset.act; if (!a || a === 'pcolorc') return;
  const pre = livePre || snap(); livePre = null;
  const n = Math.round(+i.value);
  if (a === 'w' && n >= 36) applyAll(o => o.w = n, isNode);
  if (a === 'h' && n >= 28) applyAll(o => o.h = n, isNode);
  if (a === 'tw' && n >= 40) applyAll(o => o.w = n, isText);
  if (a === 'fsc' && n >= 8 && n <= 200) applyAll(o => o.fs = n);
  if (a === 'w' || a === 'fsc') applyAll(o => fitNode(o), isNode);
  commit(pre);
  if (a === 'w' || a === 'h') physAfter(selObjs().filter(isNode).map(o => o.id));
});
panel.addEventListener('pointerdown', e => e.stopPropagation());

// ---------- keyboard ----------
const typing = () => editing || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement && document.activeElement.tagName);
window.addEventListener('keydown', e => {
  if (typing()) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (e.code === 'Space') { if (!spaceDown) { spaceDown = true; app.classList.add('panning'); } e.preventDefault(); return; }
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && e.shiftKey && (e.code === 'Period' || e.code === 'Comma')) { e.preventDefault(); stepFs(e.code === 'Period' ? 1 : -1); return; }
  if (mod && k === 'enter') { e.preventDefault(); const o = selObjs(); if (o.length === 1 && isNode(o[0])) addSibling(o[0]); return; }
  if (mod && k === 'a') { e.preventDefault(); sel = new Set(doc.items.map(i => i.id)); changed(); return; }
  if (mod && e.altKey && e.code === 'KeyC') { e.preventDefault(); if (copyStyle()) { toast('Style copied'); renderPanel(); } return; }
  if (mod && e.altKey && e.code === 'KeyV') { e.preventDefault(); pasteStyle(); return; }
  if (mod && e.code === 'KeyG') { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); return; }
  if (mod && k === 'c') { if (copy()) toast('Copied'); return; }
  if (mod && k === 'x') { cutDone = false; setTimeout(() => { if (!cutDone && copy()) del(); }, 80); return; }
  if (mod && k === 'v') { pasteDone = false; setTimeout(() => { if (!pasteDone) paste(); }, 80); return; }
  if (mod && k === 'd') { e.preventDefault(); if (copy()) paste(); return; }
  if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomBtn(1.2); return; }
  if (mod && k === '-') { e.preventDefault(); zoomBtn(1 / 1.2); return; }
  if (mod && k === '0') { e.preventDefault(); fitView(true); return; }
  if (mod) return;
  if (e.altKey && e.code === 'KeyN') { e.preventDefault(); newCanvas(); return; }
  if (e.altKey) { const am = e.shiftKey ? { KeyH: 'dh', KeyV: 'dv' } : { KeyA: 'l', KeyH: 'ch', KeyD: 'r', KeyW: 't', KeyV: 'cv', KeyS: 'b' }; if (am[e.code] && sel.size) { e.preventDefault(); arrange(am[e.code]); } return; }
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); del(); return; }
  if (k === 'escape' && $('#help').classList.contains('show')) { toggleHelp(false); return; }
  if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) { e.preventDefault(); toggleHelp(); return; }
  if (k === 'p') { togglePhys(); return; }
  if (k === 'escape' && painter) { stopBrush(); toast('Format painter cancelled'); return; }
  if (k === 'escape') { clearLP(); sel.clear(); closeMenus(); setTool('select'); changed(); return; }
  if (k === 'enter' && sel.size === 1) { const o = selObjs()[0]; if (o) { e.preventDefault(); openEditor(o.id); } return; }
  if (k === 'tab') { e.preventDefault(); const o = selObjs(); if (o.length === 1 && isNode(o[0])) quickAdd(o[0], flowSide(o[0]), o[0]); return; }
  if (k.startsWith('arrow') && sel.size) {
    e.preventDefault(); const s = e.shiftKey ? 10 : 1, dx = k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, dy = k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0;
    mutate(() => applyAll(o => { if (!o.locked) { o.x += dx; o.y += dy; } })); return;
  }
  const map = { v: 'select', h: 'hand', 1: 'rect', 2: 'roundrect', 3: 'circle', 4: 'diamond', 5: 'capsule', r: 'rect', o: 'circle', l: 'conn', t: 'text', b: 'pen', q: 'lasso' };
  if (map[k]) setTool(map[k]);
});
window.addEventListener('keyup', e => { if (e.code === 'Space') { if (!typing()) e.preventDefault(); spaceDown = false; app.classList.remove('panning'); } });
window.addEventListener('blur', () => { spaceDown = false; app.classList.remove('panning'); });

// ---------- chrome ----------
document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
$('#undo').onclick = undo; $('#redo').onclick = redo;
function zoomBtn(f) { zoomTo(view.k * f); }
$('#zIn').onclick = () => zoomBtn(1.2); $('#zOut').onclick = () => zoomBtn(1 / 1.2);
$('#zoomv').onclick = () => zoomTo(1);
$('#fit').onclick = () => fitView(true);
function setBg(b) {
  const changedBg = doc.bg !== b; doc.bg = b; app.classList.toggle('bg-blue', b === 'blue'); app.classList.toggle('bg-white', b === 'white'); app.classList.toggle('bg-dark', b === 'dark');
  applyTheme(); if (changedBg && doc.items) { draw(); renderPanel(); renderThemes(); } document.querySelectorAll('[data-bg]').forEach(x => x.classList.toggle('on', x.dataset.bg === b)); scheduleSave();
}
document.querySelectorAll('[data-bg]').forEach(b => b.onclick = () => setBg(b.dataset.bg));
$('#fname').addEventListener('change', e => { doc.name = e.target.value.trim() || 'Untitled canvas'; e.target.value = doc.name; document.title = doc.name + ' · FlowSpace'; saveNow(); scheduleSave(); });
$('#fname').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
function closeMenus() { document.querySelectorAll('.menu,.pop').forEach(m => m.classList.remove('show')); }
function renderXopts() {
  const has = [...sel].some(id => { const o = find(id); return o && !isEdge(o); });
  document.querySelectorAll('[data-xo]').forEach(t => { const k2 = t.dataset.xo; t.classList.toggle('on', !!xopts[k2] && (k2 !== 'sel' || has)); t.classList.toggle('dis', k2 === 'sel' && !has); t.title = k2 === 'sel' && !has ? 'Select something on the canvas first' : ''; });
}
$('#bExport').onclick = e => { e.stopPropagation(); const m = $('#mExport'), o = m.classList.contains('show'); closeMenus(); if (!o) { renderXopts(); m.classList.add('show'); } };
$('#mExport').addEventListener('click', e => { const t = e.target.closest('[data-xo]'); if (!t) return; e.stopPropagation(); xopts[t.dataset.xo] = !xopts[t.dataset.xo]; savePrefs(); renderXopts(); });
$('#bShare').onclick = e => { e.stopPropagation(); const m = $('#mShare'), o = m.classList.contains('show'); closeMenus(); if (!o) m.classList.add('show'); };
document.addEventListener('click', e => { if (now() - ctxAt < 450 || e.target.closest('#cv')) return; if (!document.contains(e.target) || e.target.closest('.menu,.pop,#bPhysSet,#bLayout,#bTheme')) return; closeMenus(); });
$('#bPhys').onclick = e => { e.stopPropagation(); togglePhys(); };
$('#bPhysSet').onclick = e => { e.stopPropagation(); const m = $('#pPhys'), o = m.classList.contains('show'); closeMenus(); if (!o) { renderPhys(); m.classList.add('show'); } };
$('#bTheme').onclick = e => { e.stopPropagation(); const m = $('#pTheme'), o = m.classList.contains('show'); closeMenus(); if (!o) { renderThemes(); m.classList.add('show'); } };
$('#bFiles').onclick = e => { e.stopPropagation(); const m = $('#mFiles'), o = m.classList.contains('show'); closeMenus(); if (!o) { pendingDel = null; renderFiles(); m.classList.add('show'); } };
$('#mFiles').addEventListener('click', e => {
  const t = e.target.closest('[data-f],[data-open],[data-dup],[data-delc],[data-delyes],[data-delno]'); if (!t) return;
  e.stopPropagation();
  if (t.dataset.f === 'new') return newCanvas();
  if (t.dataset.dup) { closeMenus(); return dupCanvas(t.dataset.dup); }
  if (t.dataset.delc) { pendingDel = t.dataset.delc; return renderFiles(); }
  if (t.dataset.delno) { pendingDel = null; return renderFiles(); }
  if (t.dataset.delyes) return deleteCanvas(t.dataset.delyes);
  if (t.dataset.open) { closeMenus(); if (t.dataset.open !== curId) openCanvas(t.dataset.open); }
});
$('#bLayout').onclick = e => { e.stopPropagation(); const m = $('#mLayout'), o = m.classList.contains('show'); closeMenus(); if (!o) m.classList.add('show'); };

// ---------- clipboard (system) ----------
let cutDone = true, pasteDone = true;
const selPlain = () => selObjs().filter(o => !isEdge(o) && o.text).map(o => o.text).join('\n');
function writeClip(e) { const p2 = selPlain(); e.clipboardData.setData('text/plain', p2 || ' '); e.clipboardData.setData('text/html', `<!--flowspace:${encodeURIComponent(clip)}-->` + esc(p2)); }
document.addEventListener('copy', e => { if (typing() || !copy()) return; e.preventDefault(); writeClip(e); });
document.addEventListener('cut', e => { if (typing()) return; cutDone = true; if (!copy()) return; e.preventDefault(); writeClip(e); del(); });
document.addEventListener('paste', e => {
  if (typing()) return; pasteDone = true; e.preventDefault();
  const html = e.clipboardData.getData('text/html') || '', mt = html.match(/<!--flowspace:([^>]*?)-->/);
  if (mt) { try { const j = decodeURIComponent(mt[1]); if (j !== clip) { clip = j; pasteN = 0; } } catch (er) { } paste(); return; }
  const t = e.clipboardData.getData('text/plain');
  if (t && t.trim()) pasteText(t.trim()); else paste();
});

// ---------- shortcut help ----------
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MK = isMac ? '⌘' : 'Ctrl';
const KEYS = [['Select tool', 'V'], ['Hand tool', 'H'], ['Five shapes', '1 – 5'], ['Connector', 'L'], ['Text box', 'T'], ['Select all', MK + ' A'], ['Copy', MK + ' C'], ['Cut', MK + ' X'], ['Paste', MK + ' V'], ['Duplicate', MK + ' D'], ['Delete', isMac ? 'Delete ⌫' : 'Delete'], ['Undo', MK + ' Z'], ['Redo', MK + ' Shift Z'], ['Edit selected text', 'Enter'], ['Extend with a new node', 'Tab'], ['New sibling node', MK + ' Enter'], ['Font size up / down', MK + ' Shift > / <'], ['Drag without snapping', 'hold Alt'], ['Exit editing / deselect', 'Esc'], ['Nudge 1px / 10px', 'Arrows · Shift'], ['Zoom in / out', MK + ' + / −'], ['Fit to screen', MK + ' 0'], ['Pan canvas', 'Space + drag'], ['Elastic mode on/off', 'P'], ['Pen', 'B'], ['Lasso select', 'Q · or Alt + drag'], ['iPad long-press', 'object: menu · empty: lasso'], ['Right-click menu', 'copy, group, painter…'], ['Group / ungroup', MK + ' G · ' + MK + ' Shift G'], ['Copy / paste style', MK + ' Alt C · V'], ['Align left / right / top / bottom', 'Alt A · D · W · S'], ['Center horizontally / vertically', 'Alt H · V'], ['Distribute horizontally / vertically', 'Alt Shift H · V'], ['Trackpad pan / zoom', 'two-finger swipe · pinch'], ['iPad handwriting', 'write with Apple Pencil'], ['Label a connector', 'double-click it'], ['New canvas', 'Alt N'], ['Shortcuts', '?']];
$('#kgrid').innerHTML = KEYS.map(([a, b]) => `<div><span>${a}</span><kbd>${b}</kbd></div>`).join('');
function toggleHelp(show) { const h = $('#help'); h.classList.toggle('show', show === undefined ? !h.classList.contains('show') : show); }
$('#keys').onclick = () => toggleHelp(true);
$('#helpX').onclick = () => toggleHelp(false);
$('#help').addEventListener('click', e => { if (e.target.id === 'help') toggleHelp(false); });
let toastT = 0;
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

// ---------- export / import ----------
const dlP = Promise.resolve(null);
async function saveFile(name, data, mime) {
  const dl = await dlP;
  if (dl) {
    try { await dl.save({ filename: name, data }); toast('Exported ' + name); }
    catch (err) { if (err && err.code === 'declined') return; toast('Export failed: ' + ((err && (err.message || err.code)) || 'unknown reason')); }
    return;
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function exportSVG() {
  if (!doc.items.length) { toast('The canvas is empty'); return null; }
  const selItems = [...expandGroups(new Set(sel))].map(find).filter(o => o && !isEdge(o)), onlySel = xopts.sel && selItems.length;
  const items = onlySel ? doc.items.filter(i => selItems.includes(i)) : doc.items, ids = new Set(items.map(i => i.id));
  const edges = onlySel ? doc.edges.filter(e => ids.has(e.from) && ids.has(e.to)) : doc.edges;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const it of items) { const b = bbox(it); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  const P = 48; x0 -= P; y0 -= P; x1 += P; y1 += P;
  const W = Math.ceil(x1 - x0), H = Math.ceil(y1 - y0);
  const nodes = items.filter(isNode), texts = items.filter(isText), inks = items.filter(isInk);
  const bgr = xopts.transparent ? '' : `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="${canvasBg(doc)}"/>`;
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${x0} ${y0} ${W} ${H}" font-family="${FONT}"><defs>${buildDefs(C)}</defs>${bgr}${edges.map(e => edgeSVG(e, true)).join('')}${nodes.map(n => nodeSVG(n, true)).join('')}${inks.map(k => inkSVG(k, true)).join('')}${texts.map(t => textItemSVG(t, true)).join('')}</svg>`;
  return { s, W, H };
}
const fileBase = () => (doc.name || 'FlowSpace').replace(/[\\/:*?"<>|]/g, '_');
async function doExport(kind) {
  closeMenus(); if (editing) closeEditor();
  if (kind === 'json') return saveFile(fileBase() + '.json', JSON.stringify({ app: 'FlowSpace', version: 1, doc }, null, 2), 'application/json');
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
  } catch (err) { toast('PNG export failed — try SVG instead'); }
}
document.querySelectorAll('.menu [data-m]').forEach(b => b.addEventListener('click', () => doExport(b.dataset.m)));
$('#fileIn').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const o = JSON.parse(await f.text()), d = o.doc || o;
    if (!Array.isArray(d.items)) throw 0;
    const nd = normDoc(Object.assign(blankDoc(), d)); if (!d.name) nd.name = f.name.replace(/\.json$/i, '');
    newCanvas(nd, `Imported as “${uniqueName(nd.name)}”`);
  } catch (err) { toast('That file isn’t a FlowSpace canvas'); }
});

// ---------- boot ----------
setTool('select');
load();
window.addEventListener('pagehide', () => { if (curId) saveNow(); });
window.addEventListener('resize', () => { drawUI(); if (editing) placeEditor(); });
}
