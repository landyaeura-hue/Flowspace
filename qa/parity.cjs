// Parity check: drives the original single-file preview (qa/preview-reference.html) and this app
// through the same steps, then compares saved data and screenshots.
// Usage: npm run build && node qa/parity.cjs   (needs Python 3 + Pillow for the pixel diff)
// Known noise: mouse-drawn pen strokes use simulated pressure that varies between runs.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'qa', 'out');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
http.createServer((q, s) => { s.setHeader('content-type', 'text/html'); s.end(fs.readFileSync(path.join(ROOT, 'qa', 'preview-reference.html'))); }).listen(4301);
const vp = spawn('npx', ['vite', 'preview', '--port', '4302', '--strictPort'], { cwd: ROOT, shell: process.platform === 'win32' });
const STEPS = [
  ['boot', async p => {}],
  ['edit-text', async p => { await p.mouse.dblclick(640, 345); await sleep(150); await p.keyboard.press('Control+a'); await p.keyboard.type('Edited 中文'); await p.mouse.click(1250, 700); }],
  ['add-shapes', async p => { await p.keyboard.press('3'); await p.mouse.click(260, 640); await p.keyboard.press('Escape'); await p.keyboard.press('4'); await p.mouse.click(520, 700); await p.keyboard.press('Escape'); }],
  ['connect', async p => { await p.keyboard.press('l'); await p.mouse.move(260, 640); await p.mouse.down(); await p.mouse.move(400, 680, { steps: 6 }); await p.mouse.move(520, 700, { steps: 6 }); await p.mouse.up(); await p.keyboard.press('v'); }],
  ['tab-extend', async p => { await p.mouse.click(1150, 330); await p.keyboard.press('Tab'); await sleep(100); await p.keyboard.type('Next'); await p.keyboard.press('Escape'); }],
  ['pen', async p => { await p.keyboard.press('b'); await p.mouse.move(800, 600); await p.mouse.down(); for (let i = 0; i < 20; i++) await p.mouse.move(800 + i * 8, 600 + Math.sin(i / 2) * 20); await p.mouse.up(); await sleep(2000); await p.keyboard.press('v'); }],
  ['lasso-group', async p => { await p.keyboard.press('q'); await p.mouse.move(200, 580); await p.mouse.down(); for (const [x, y] of [[620, 580], [620, 780], [200, 780], [200, 585]]) await p.mouse.move(x, y, { steps: 8 }); await p.mouse.up(); await sleep(150); await p.keyboard.press('Escape'); await p.keyboard.press('Control+a'); await p.keyboard.press('Control+g'); }],
  ['copy-paste', async p => { await p.mouse.click(1150, 330); await p.keyboard.press('Control+d'); }],
  ['drag-physics', async p => { await p.keyboard.press('p'); await p.mouse.move(640, 345); await p.mouse.down(); await p.mouse.move(450, 330, { steps: 10 }); await p.mouse.up(); await sleep(5000); }],
  ['arrange', async p => { await p.keyboard.press('p'); await p.keyboard.press('Control+a'); await p.keyboard.press('Alt+w'); }],
  ['context-menu', async p => { await p.mouse.click(1250, 760); await p.mouse.click(1150, 330, { button: 'right' }); await sleep(200); }],
  ['zoom-fit', async p => { await p.keyboard.press('Escape'); await p.keyboard.press('Control+0'); await sleep(500); }],
  ['undo3', async p => { for (let i = 0; i < 3; i++) await p.keyboard.press('Control+z'); }],
  ['new-canvas', async p => { await p.keyboard.press('Alt+n'); await sleep(400); }],
  ['switch-back', async p => { await p.click('#bFiles'); await sleep(200); await p.locator('#mFiles [data-open]').nth(1).click(); await sleep(400); }],
  ['panel', async p => { await p.mouse.click(1150, 330); await sleep(200); }],
];
(async () => {
  await sleep(2500);
  const browser = await chromium.launch();
  const R = {};
  for (const [name, url] of [['orig', 'http://localhost:4301/'], ['new', 'http://localhost:4302/']]) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { let s = 42; Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; let t = 0; const m = new WeakMap(); Object.defineProperty(Event.prototype, 'timeStamp', { get() { if (!m.has(this)) m.set(this, t += 16); return m.get(this); } }); });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(url); await sleep(800);
    R[name] = { errs, stores: [] };
    for (const [sn, fn] of STEPS) {
      await fn(p); await sleep(450);
      await p.screenshot({ path: path.join(OUT, `${name}-${sn}.png`) });
      R[name].stores.push(await p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } const ix = JSON.parse(o['flowspace.index'] || 'null'); if (ix) ix.list.forEach(x => delete x.updated); o['flowspace.index'] = JSON.stringify(ix); return JSON.stringify(o, Object.keys(o).sort()); }));
    }
    await ctx.close();
  }
  const { execSync } = require('child_process');
  // ids are random and pen pressure is time-based, so normalise both before comparing
  const norm = raw => {
    const d = JSON.parse(raw), o = {}, ids = new Map();
    for (const [k, v] of Object.entries(d)) {
      const val = v && '{['.includes(v[0]) ? JSON.parse(v) : v;
      if (k.startsWith('flowspace.doc.')) o['doc:' + val.doc.name] = val;
      else if (k === 'flowspace.index') o[k] = { current: d['flowspace.doc.' + val.current] && JSON.parse(d['flowspace.doc.' + val.current]).doc.name, list: val.list.map(x => x.name) };
      else o[k] = val;
    }
    const sorted = JSON.stringify(o, Object.keys(o).sort());
    return sorted.replace(/\b[cntkeg][0-9a-z]{7}\b|\b[ntkeg]_[a-z0-9]+\b/g, m => { if (!ids.has(m)) ids.set(m, 'ID' + ids.size); return ids.get(m); })
      .replace(/\[(-?[\d.]+),(-?[\d.]+),[\d.]+\]/g, '[$1,$2,P]');
  };
  let ok = true;
  STEPS.forEach(([sn], i) => {
    const same = norm(R.orig.stores[i]) === norm(R.new.stores[i]);
    let px = '?';
    try { px = execSync(`python3 -c "from PIL import Image,ImageChops;a=Image.open(r'${path.join(OUT, `orig-${sn}.png`)}').convert('RGB');b=Image.open(r'${path.join(OUT, `new-${sn}.png`)}').convert('RGB');print(ImageChops.difference(a,b).point(lambda v:255 if v>16 else 0).getbbox())"`).toString().trim(); } catch (e) { }
    if (!same) ok = false;
    console.log(sn.padEnd(14), 'data:', same ? 'same' : 'DIFF', '  pixel diff box:', px);
  });
  console.log('errors orig:', R.orig.errs, 'new:', R.new.errs);
  fs.writeFileSync(path.join(OUT, "stores.json"), JSON.stringify(R)); console.log(ok ? 'DATA IDENTICAL (check any pixel diff boxes sit on pen strokes)' : 'DATA DIFFERS');
  await browser.close(); vp.kill(); process.exit(0);
})();
