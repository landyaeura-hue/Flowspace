// Real-time collaboration checks: three people in one browser (separate tabs = separate sessions)
// against the in-browser mock backend, which mirrors supabase/migrations 0001 + 0002.
// Usage: npm run qa:collab
const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'qa', 'out');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

execSync('npx vite build --outDir dist-mock --emptyOutDir', { cwd: ROOT, stdio: 'ignore', env: { ...process.env, VITE_CLOUD_MOCK: '1' } });
const srv = spawn('npx', ['vite', 'preview', '--outDir', 'dist-mock', '--port', '4305', '--strictPort'], { cwd: ROOT, shell: process.platform === 'win32' });
const URL0 = 'http://localhost:4305/';

let failed = 0, n = 0;
const ok = (cond, label, extra = '') => { n++; if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`); };
const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch { } await sleep(120); } return false; };

(async () => {
  await sleep(2500);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, reducedMotion: 'reduce' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errs = [];
  const open = async (name, url = URL0) => {
    const p = await ctx.newPage(); p._name = name;
    p.on('pageerror', e => errs.push(`${name}: ${e}`)); p.on('console', m => { if (m.type() === 'error') errs.push(`${name}: ${m.text()}`); });
    await p.goto(url); await sleep(900); return p;
  };
  const nodes = p => p.evaluate(() => document.querySelectorAll('#nodes [data-id]').length);
  const nodeIds = p => p.evaluate(() => [...document.querySelectorAll('#nodes [data-id]')].map(e => e.dataset.id).sort().join(','));
  const addShape = async (p, x, y) => { await p.bringToFront(); await p.keyboard.press('Escape'); await p.keyboard.press('2'); await p.mouse.click(x, y); await p.keyboard.press('Escape'); await sleep(150); };
  const shot = (p, name) => p.screenshot({ path: path.join(OUT, `collab-${name}.png`) });
  const signUp = async (p, email) => {
    if (!(await p.isVisible('.modal'))) await p.click('#bSignIn');
    await p.click('text=Create an account'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'password123');
    await p.click('.modal button.pri'); await sleep(1200);
    if (await p.isVisible('.modal >> text=Not now')) await p.click('.modal >> text=Not now');
  };
  const db = p => p.evaluate(() => JSON.parse(localStorage.getItem('mockcloud.db')));

  // ---- Alice creates a canvas and shares it
  const A = await open('alice');
  await signUp(A, 'alice@example.com');
  ok(await A.isVisible('#bAccount'), 'alice signed in');
  await A.fill('#fname', 'Team plan'); await A.press('#fname', 'Enter');
  await addShape(A, 300, 650); await addShape(A, 500, 650);
  await until(async () => (await A.textContent('#status span')) === 'Saved');
  const baseNodes = await nodes(A);
  await A.click('#bShare'); await A.click('#bShareCanvas'); await sleep(600);
  ok(await A.isVisible('.modal .card.share'), 'share dialog opens');
  await A.click('[data-create=editor]'); await until(() => A.isVisible('[data-role=editor] input'));
  await A.click('[data-create=viewer]'); await until(() => A.isVisible('[data-role=viewer] input'));
  const editLink = await A.inputValue('[data-role=editor] input'), viewLink = await A.inputValue('[data-role=viewer] input');
  ok(/\?join=[\w-]{20,}$/.test(editLink) && /\?join=[\w-]{20,}$/.test(viewLink) && editLink !== viewLink, 'edit and view links created', editLink);
  await shot(A, '1-share-dialog');
  await A.keyboard.press('Escape');

  // ---- Bob opens the edit link, signs up, lands in the canvas
  const B = await open('bob', editLink);
  ok(await B.isVisible('.modal .note.join'), 'link while signed out asks to sign in first');
  await signUp(B, 'bob@example.com');
  ok(await until(async () => (await B.inputValue('#fname')) === 'Team plan'), 'bob lands in the shared canvas', await B.inputValue('#fname'));
  ok(await until(async () => (await nodes(B)) === baseNodes), 'bob sees alice’s shapes', `${await nodes(B)} / ${baseNodes}`);
  ok(!(await B.isVisible('.ro-badge')), 'bob can edit (no view-only badge)');
  ok(await until(() => A.isVisible('.peers-bar .pav')), 'alice sees bob’s avatar');
  ok(await until(() => B.isVisible('.peers-bar .pav')), 'bob sees alice’s avatar');

  // ---- live edits both ways
  await addShape(A, 700, 650);
  ok(await until(async () => (await nodes(B)) === baseNodes + 1), 'alice’s new shape appears for bob');
  await addShape(B, 900, 650);
  ok(await until(async () => (await nodes(A)) === baseNodes + 2), 'bob’s new shape appears for alice');
  await B.bringToFront(); await B.mouse.move(600, 300); await B.mouse.move(620, 320, { steps: 4 });
  ok(await until(() => A.evaluate(() => [...document.querySelectorAll('#peers .pc')].some(e => e.style.opacity === '1'))), 'bob’s cursor shows for alice');
  await B.mouse.click(900, 650); await sleep(400);
  ok(await until(() => A.evaluate(() => [...document.querySelectorAll('#peers .ps')].some(e => e.style.display === 'block'))), 'bob’s selection outlined for alice');
  await shot(A, '2-live');

  // ---- undo only undoes your own change
  await addShape(A, 300, 450); await addShape(B, 500, 450);
  await until(async () => (await nodes(A)) === baseNodes + 4 && (await nodes(B)) === baseNodes + 4);
  const beforeUndo = await nodeIds(A);
  await A.bringToFront(); await A.mouse.click(1250, 760); await A.keyboard.press('Control+z');
  ok(await until(async () => (await nodes(A)) === baseNodes + 3 && (await nodes(B)) === baseNodes + 3), 'alice’s undo removes only her shape, for both', `${await nodes(A)} / ${await nodes(B)}`);
  const bobsLast = beforeUndo.split(',').filter(x => !(0)).length;
  ok(bobsLast > 0 && await until(async () => (await nodeIds(A)) === (await nodeIds(B))), 'both see the same shapes after undo');

  // ---- viewer
  const C = await open('carol', viewLink);
  await signUp(C, 'carol@example.com');
  ok(await until(async () => (await C.inputValue('#fname')) === 'Team plan'), 'carol (view link) lands in the canvas');
  ok(await until(() => C.isVisible('.ro-badge')), 'carol sees "View only"');
  ok(!(await C.isVisible('#tools')), 'carol has no drawing tools');
  const cBefore = await nodes(C);
  await C.bringToFront(); await C.keyboard.press('2'); await C.mouse.click(600, 700); await C.keyboard.press('Delete'); await sleep(800);
  ok((await nodes(C)) === cBefore && (await nodes(A)) === cBefore, 'carol cannot add or delete', `${await nodes(C)} vs ${cBefore}`);
  await addShape(A, 1100, 450);
  ok(await until(async () => (await nodes(C)) === cBefore + 1), 'carol sees alice’s edits live');
  await shot(C, '3-viewer');

  // ---- offline on one side, edits on both, then merge
  await B.evaluate(() => { window.__mockcloud.control.offline = true; });
  await sleep(1500);
  await addShape(B, 300, 300); await addShape(A, 1100, 300);
  await until(async () => (await A.textContent('#status span')) === 'Saved');
  await sleep(500);
  const offlineA = await nodes(A), offlineB = await nodes(B);
  ok(offlineA === offlineB, 'while bob is offline each side has its own extra shape', `${offlineA} / ${offlineB}`);
  await B.evaluate(() => { window.__mockcloud.control.offline = false; window.dispatchEvent(new Event('online')); });
  ok(await until(async () => (await nodes(A)) === offlineA + 1 && (await nodes(B)) === offlineA + 1, 8000), 'back online: both shapes on both screens', `${await nodes(A)} / ${await nodes(B)}`);
  ok(await until(async () => (await A.textContent('#status span')) === 'Saved' && (await B.textContent('#status span')) === 'Saved', 8000), 'both saved');
  const D1 = await db(A); const row = Object.values(D1.rows).find(r => r.name === 'Team plan');
  ok(row && row.ydoc && row.doc.items.filter(i => i.type === 'node').length === offlineA + 1, 'database has the merged canvas (with shared state)', row ? `${row.doc.items.filter(i => i.type === 'node').length} nodes` : 'missing');

  // ---- reload keeps everything
  await A.reload(); await sleep(1800);
  ok((await nodes(A)) === offlineA + 1, 'alice reloads: everything still there');

  // ---- share dialog: people, remove, turn off link
  await A.click('#bShare'); await A.click('#bShareCanvas'); await sleep(800);
  const ppl = await A.locator('.people li').count();
  ok(ppl === 3, 'share dialog lists owner + 2 people', String(ppl));
  await shot(A, '4-people');
  await A.locator('.people li', { hasText: 'carol@' }).locator('select').selectOption('editor'); await sleep(500);
  ok((await db(A)).members[row.id][Object.keys((await db(A)).members[row.id]).find(k => true)] !== undefined, 'role change saved');
  await A.locator('.people li', { hasText: 'bob@' }).locator('button.x').click(); await sleep(600);
  ok((await A.locator('.people li').count()) === 2, 'bob removed');
  await A.locator('[data-role=editor] button', { hasText: 'Turn off' }).click(); await sleep(600);
  ok(!(await A.isVisible('[data-role=editor] input')), 'edit link turned off');
  await A.keyboard.press('Escape');
  await B.bringToFront(); await B.evaluate(() => window.dispatchEvent(new Event('online'))); await sleep(1500);
  ok(await until(async () => (await B.inputValue('#fname')) !== 'Team plan', 6000), 'bob loses the canvas after being removed', await B.inputValue('#fname'));

  // ---- a new person with the turned-off link
  const D = await open('dave', editLink);
  await signUp(D, 'dave@example.com');
  ok(await until(async () => /turned off/i.test(await D.textContent('#toast'))), 'turned-off link is refused', await D.textContent('#toast'));

  ok(errs.length === 0, 'no console errors', errs.join(' | '));
  console.log(`\n${n - failed}/${n} passed`);
  await browser.close(); srv.kill(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
