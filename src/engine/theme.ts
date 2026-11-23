// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.
import { STATE } from './state';
import { THEMES } from './themes';
import { INK } from './constants';
import { $, RM } from './dom';
import { toast } from './help';
import { renderPanel } from './panel';
import { renderPhys } from './physics';
import { draw } from './render';
import { isNode } from './state-init';
import { scheduleSave } from './storage';

export function palOf(d) { const T = THEMES[d && d.theme] || THEMES.mist; return d && d.bg === 'dark' ? Object.assign({ dark: true }, T.dark) : T.light; }
export function buildDefs(P) {
  const dk = !!P.dark, g = (id, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient>`;
  const f = (id, col, dy, sd, o1, h) => `<filter id="${id}" x="-30%" y="-40%" width="160%" height="${h}%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="${dy}" stdDeviation="${sd}" flood-color="${col}" flood-opacity="${o1}"/><feDropShadow dx="0" dy="${dy > 15 ? 3 : 1.5}" stdDeviation="${dy > 15 ? 3 : 1.5}" flood-color="${col}" flood-opacity="${dk ? .35 : .08}"/></filter>`;
  const mk = (id, c, sz) => `<marker id="${id}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="${sz}" markerHeight="${sz}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1.5 1.8L10.5 6 1.5 10.2Q3.2 6 1.5 1.8z" fill="${c}" stroke="${c}" stroke-width="1" stroke-linejoin="round"/></marker>`;
  return Object.keys(GID).map(k => P.f[k] ? g(GID[k], P.f[k]) : '').join('') +
    f('shW', P.sh, 12, 14, dk ? .5 : .13, 200) + f('shWL', P.sh, 20, 20, dk ? .65 : .2, 220) + f('shB', P.shB, 12, 14, dk ? .55 : .2, 200) + f('shBL', P.shB, 20, 20, dk ? .7 : .28, 220) +
    mk('ar', P.line, 12) + mk('arS', P.selStrong, 14);
}
export const GID = { white: 'gW', soft: 'gS', blue: 'gB', accent: 'gA', strong: 'gT', deep: 'gD' };
export const FILL_NAMES = { white: 'White', soft: 'Tint', blue: 'Light', accent: 'Accent', strong: 'Mid', deep: 'Deep' };
export function fillOf(k) {
  const f = STATE.C.f[k];
  if (f) return { f: `url(#${GID[k]})`, s: f[2], sh: k === 'white' || k === 'soft' ? 'shW' : 'shB' };
  return { f: k, s: STATE.C.dark ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.7)', sh: 'shB' };
}
export const isAutoInk = c => !c || c === 'auto' || c === INK;
export function lum(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null;
  let h = m[1]; if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const v = [0, 2, 4].map(i => { const c = parseInt(h.substr(i, 2), 16) / 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); });
  return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
}
export const contrast = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
export function autoInk(fillHex) {
  const L = lum(fillHex); if (L == null) return STATE.C.ink;
  const T = THEMES[STATE.doc.theme] || THEMES.mist, darkInk = T.light.ink, lightInk = STATE.C.dark ? STATE.C.ink : '#FFFFFF';
  return contrast(L, lum(darkInk)) >= contrast(L, lum(lightInk)) ? darkInk : lightInk;
}
export const tc = o => !isAutoInk(o.color) ? o.color : isNode(o) ? autoInk(STATE.C.f[o.fill] ? STATE.C.f[o.fill][1] : o.fill) : STATE.C.ink;
export const canvasBg = d => d.bg === 'white' ? '#FFFFFF' : palOf(d).cbg;
export function applyTheme() {
  STATE.C = palOf(STATE.doc); const dk = !!STATE.C.dark, st = STATE.app.style;
  $('#defs').innerHTML = buildDefs(STATE.C);
  STATE.app.classList.toggle('dark', dk);
  const vars = { '--cbg': STATE.C.cbg, '--cbg2': STATE.C.cbg2, '--ink': STATE.C.ink, '--ink2': STATE.C.ink2, '--acc': STATE.C.acc, '--on': STATE.C.on, '--sel': STATE.C.sel, '--selSoft': STATE.C.selSoft, '--ring': STATE.C.ring, '--lineH': STATE.C.lineH, '--tip': dk ? STATE.C.ink : STATE.C.ink, '--pri': STATE.C.ink, '--priH': STATE.C.lineH, '--card': dk ? STATE.C.card : 'rgba(255,255,255,.92)', '--raised': dk ? STATE.C.raised : '#fff' };
  for (const k in vars) st.setProperty(k, vars[k]);
  const T = THEMES[STATE.doc.theme] || THEMES.mist;
  const b1 = document.querySelector<HTMLInputElement>('[data-bg=blue]'), b3 = document.querySelector<HTMLInputElement>('[data-bg=dark]');
  if (b1) b1.style.background = `linear-gradient(135deg,${T.light.cbg2},${T.light.f.blue[1]})`;
  if (b3) b3.style.background = `linear-gradient(135deg,${T.dark.cbg2},${T.dark.cbg})`;
  const lg = document.querySelector<HTMLInputElement>('.logo svg'); if (lg) lg.setAttribute('stroke', dk ? '#fff' : STATE.C.ink);
}
export function setTheme(key) {
  if (!THEMES[key] || STATE.doc.theme === key) return;
  STATE.doc.theme = key; applyTheme(); draw(); renderPanel(); renderPhys(); renderThemes(); scheduleSave();
  if (!RM) { STATE.world.style.animation = 'none'; requestAnimationFrame(() => { STATE.world.style.animation = 'k-fade .35s ease-out'; }); }
  toast(`Theme: ${THEMES[key].name}`);
}
export function themeThumb(T, dk) {
  const P = dk ? T.dark : T.light;
  return `<svg viewBox="0 0 64 42"><rect width="64" height="42" fill="${P.cbg}"/><path d="M22 15h7v13h6" fill="none" stroke="${P.line}" stroke-width="1.2"/><rect x="6" y="9" width="18" height="11" rx="4" fill="${P.f.white[0]}" stroke="${P.f.white[2]}" stroke-width=".6"/><rect x="33" y="22" width="24" height="12" rx="4" fill="${P.f.blue[1]}"/><rect x="38" y="7" width="20" height="9" rx="4.5" fill="${P.f.accent[1]}"/><rect x="9" y="13.6" width="9" height="1.8" rx=".9" fill="${P.ink}" opacity=".7"/></svg>`;
}
export function renderThemes() {
  const dk = STATE.doc.bg === 'dark';
  $('#pTheme').innerHTML = `<h4>Color theme</h4><div class="thg">${Object.entries(THEMES).map(([k, T]) => `<button class="thc ${STATE.doc.theme === k ? 'on' : ''}" data-theme="${k}">${themeThumb(T, dk)}<div><b>${T.name}</b><span class="note" style="margin:0">${T.note}</span><div class="dots">${T.sw.slice(1).map(c => `<i style="background:${c}"></i>`).join('')}</div></div><span class="ck">✓</span></button>`).join('')}</div>
  <p class="note" style="margin-top:10px">Each canvas keeps its own theme. Nodes using theme fills recolor automatically; custom colors stay as they are.</p>`;
}

/** Runs once at mount, in the original top-to-bottom order of the preview. */
export function initTheme() {
  STATE.C = THEMES.mist.light;
  $('#pTheme').addEventListener('click', e => { const b = (e.target as HTMLInputElement).closest<HTMLInputElement>('[data-theme]'); if (b) setTheme(b.dataset.theme); });
}
