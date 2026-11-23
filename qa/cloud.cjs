// Cloud-saving checks against the in-browser mock backend (same rules as the Supabase schema).
// Usage: npm run qa:cloud   (builds with VITE_CLOUD_MOCK=1 into dist-mock, then drives it with Playwright)
const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'qa', 'out');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

execSync('npx vite build --outDir dist-mock --emptyOutDir', { cwd: ROOT, stdio: 'ignore', env: { ...process.env, VITE_CLOUD_MOCK: '1' } });
const srv = spawn('npx', ['vite', 'preview', '--outDir', 'dist-mock', '--port', '4303', '--strictPort'], { cwd: ROOT, shell: process.platform === 'win32' });

let failed = 0, n = 0;
const ok = (cond, label, extra = '') => { n++; if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`); };

(async () => {
  await sleep(2500);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const status = () => p.textContent('#status span');
  const db = () => p.evaluate(() => JSON.parse(localStorage.getItem('mockcloud.db') || '{"rows":{}}'));
  const rows = async () => Object.values((await db()).rows);
  const waitStatus = async (want, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await status()) === want) return true; await sleep(100); } return false; };
  const shot = name => p.screenshot({ path: path.join(OUT, `cloud-${name}.png`) });
  const addShape = async (x, y) => { await p.keyboard.press('Escape'); await p.keyboard.press('2'); await p.mouse.click(x, y); await p.keyboard.press('Escape'); };
  const curId = () => p.evaluate(() => { const u = localStorage.getItem('flowspace.lastUser'); return JSON.parse(localStorage.getItem(`flowspace.u.${u}.index`)).current; });

  await p.goto('http://localhost:4303/'); await sleep(900);
  ok(await p.isVisible('#bSignIn'), 'signed out: "Sign in" button shown');
  ok((await status()) === 'Saved locally', 'signed out: local saving as before', await status());
  await addShape(300, 650); await sleep(600);
  await p.keyboard.press('Alt+n'); await sleep(400); await addShape(500, 400); await sleep(600);
  await shot('1-local');

  // ---- create an account → upload offer
  await p.click('#bSignIn'); await sleep(200);
  await p.click('text=Create an account'); await sleep(150);
  await p.fill('input[type=email]', 'ada@example.com'); await p.fill('input[type=password]', 'password123');
  await shot('2-signup');
  await p.click('.modal button.pri'); await sleep(1200);
  ok(await p.isVisible('#bAccount'), 'signed up: avatar shown');
  ok(await p.isVisible('#bUpload'), 'upload offer appears for the 2 local canvases', await p.textContent('.modal .card').catch(() => ''));
  await shot('3-upload-offer');
  await p.click('#bUpload');
  ok(await waitStatus('Saved'), 'uploaded and saved', await status());
  let R = await rows();
  ok(R.length === 2, 'server has exactly the 2 uploaded canvases (auto-created blank one replaced)', R.map(r => r.name).join(', '));
  await sleep(300);
  await p.click('#bFiles'); await sleep(300);
  const sub = await p.textContent('#mFiles .mh span');
  ok(/in your account/.test(sub), 'canvas list says "in your account"', sub);
  ok(!(await p.isVisible('[data-x=upload]')), 'no further upload entry');
  await shot('4-cloud-list'); await p.keyboard.press('Escape'); await p.mouse.click(1250, 760);

  // ---- autosave + version + thumbnail
  const id = await curId();
  const v0 = (await db()).rows[id].version;
  await addShape(700, 300);
  await sleep(500); ok(['Saving…', 'Saved'].includes(await status()), 'edit shows Saving…', await status());
  ok(await waitStatus('Saved'), 'edit saved');
  let row = (await db()).rows[id];
  ok(row.version === v0 + 1 && row.node_count === row.doc.items.filter(i => i.type === 'node').length, 'server version bumped once, node count stored', `v${v0}→v${row.version}, ${row.node_count} nodes`);
  ok(!!row.thumb_path && !!(await db()).thumbs[row.thumb_path], 'thumbnail uploaded', row.thumb_path);

  // ---- offline
  await p.evaluate(() => { window.__mockcloud.control.offline = true; });
  await addShape(900, 300);
  ok(await waitStatus('Offline · saved on this device'), 'offline: status says saved on this device', await status());
  const before = (await db()).rows[id].version;
  await p.evaluate(() => { window.__mockcloud.control.offline = false; window.dispatchEvent(new Event('online')); });
  ok(await waitStatus('Saved'), 'back online: synced');
  ok((await db()).rows[id].version === before + 1, 'offline edit reached the server');

  // (concurrent edits on two devices now merge through Yjs: see qa/collab.cjs)
  const nameBefore = await p.inputValue('#fname');

  // ---- reload: still signed in, cloud space opens directly, no second upload offer
  await p.reload(); await sleep(1500);
  ok(await p.isVisible('#bAccount') && !(await p.isVisible('.modal')), 'after reload: signed in, no dialog');
  ok((await p.inputValue('#fname')) === nameBefore, 'after reload: same canvas open', await p.inputValue('#fname'));

  // ---- "new device": drop this account's cache, reload → list from server, docs fetched on open
  await p.evaluate(() => { const u = localStorage.getItem('flowspace.lastUser'); for (const k of Object.keys(localStorage)) if (k.startsWith(`flowspace.u.${u}.`)) localStorage.removeItem(k); });
  await p.reload(); await sleep(2000);
  await p.click('#bFiles'); await sleep(500);
  const nRows = await p.locator('#mFiles [data-open]').count(), imgs = await p.locator('#mFiles img.th').count();
  ok(nRows === 2, 'fresh device: both canvases listed', String(nRows));
  ok(imgs >= 1, 'fresh device: server thumbnails shown for canvases not yet downloaded', `${imgs} images`);
  await shot('6-fresh-device-list');
  const other = p.locator('#mFiles [data-open]:not(.cur)').first(); const otherName = await other.locator('.fn').textContent();
  await other.click(); await sleep(1000);
  ok((await p.inputValue('#fname')) === otherName, 'opening an uncached canvas downloads it', otherName);

  // ---- delete
  await p.click('#bFiles'); await sleep(300);
  const victim = p.locator('#mFiles [data-open]:not(.cur)').first(); const vid = await victim.getAttribute('data-open');
  await victim.hover(); await victim.locator('[data-delc]').click(); await sleep(150); await p.click('[data-delyes]');
  await sleep(1500);
  ok(!(await db()).rows[vid], 'deleted canvas removed from the server');
  await p.keyboard.press('Escape'); await p.mouse.click(1250, 760);

  // ---- sign out → local canvases, cache cleared; sign in again
  await p.click('#bAccount'); await sleep(200); await shot('7-account-menu');
  await p.click('#bSignOut'); await sleep(800);
  ok(await p.isVisible('#bSignIn'), 'signed out');
  ok((await status()) === 'Saved locally', 'back to local canvases', await status());
  const leftovers = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('flowspace.u.')).length);
  ok(leftovers === 0, 'account cache removed from this browser on sign-out', String(leftovers));
  await p.click('#bSignIn'); await sleep(200);
  await p.fill('input[type=email]', 'ada@example.com'); await p.fill('input[type=password]', 'wrong-pass');
  await p.click('.modal button.pri'); await sleep(500);
  ok(await p.isVisible('.modal .err'), 'wrong password shows an error', await p.textContent('.modal .err').catch(() => ''));
  await p.fill('input[type=password]', 'password123'); await p.click('.modal button.pri'); await sleep(1500);
  ok(await p.isVisible('#bAccount') && !(await p.isVisible('.modal')), 'signed in again, no repeated upload offer');
  await p.click('#bFiles'); await sleep(400);
  ok((await p.locator('#mFiles [data-open]').count()) === 1, 'account canvases back after sign-in');
  await shot('8-signed-in-again');

  ok(errs.length === 0, 'no console errors', errs.join(' | '));
  console.log(`\n${n - failed}/${n} passed`);
  await browser.close(); srv.kill(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
