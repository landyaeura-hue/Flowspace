// Splits src/engine/engine.ts (one big closure) into ES modules, one per section.
// - Every top-level `let`, and every top-level const whose initializer depends on other
//   engine names or on the DOM, becomes a field of the shared STATE object.
// - All non-declaration statements and state initialisations go into init_<section>(),
//   called in original order, so runtime behaviour is unchanged.
// - Functions and pure consts are exported; cross-module references become imports.
const ts = require('/home/claude/Flowspace/node_modules/typescript');
const fs = require('fs'), path = require('path');
const SRC = '/home/claude/Flowspace/src/engine/engine.ts';
const OUT = '/home/claude/Flowspace/src/engine';
const ST = 'STATE';

const SECTIONS = [ // [marker regex | null for start, module name]
  [null, 'dom'], [/^let C = /, 'theme'], [/^\/\/ -+ state/, 'state-init'], [/^\/\/ -+ text measuring/, 'text'],
  [/^\/\/ -+ shapes/, 'shapes'], [/^\/\/ -+ ink/, 'ink'], [/^\/\/ -+ connector routing/, 'routing'],
  [/^\/\/ -+ render/, 'render'], [/^\/\/ -+ history/, 'storage'], [/^\/\/ -+ coordinates/, 'coords'],
  [/^\/\/ -+ editing/, 'editing'], [/^\/\/ -+ pointer/, 'pointer'], [/^\/\/ -+ alignment/, 'guides'],
  [/^\/\/ -+ quick extend/, 'quick-extend'], [/^\/\/ -+ physics/, 'physics'], [/^\/\/ -+ auto layout/, 'layout'],
  [/^\/\/ -+ selection ops/, 'selection'], [/^\/\/ -+ property panel/, 'panel'], [/^\/\/ -+ keyboard/, 'keyboard'],
  [/^\/\/ -+ chrome/, 'chrome'], [/^\/\/ -+ clipboard/, 'clipboard'], [/^\/\/ -+ shortcut help/, 'help'],
  [/^\/\/ -+ export/, 'export'], [/^\/\/ -+ boot/, 'boot'],
];
const text = fs.readFileSync(SRC, 'utf8');
const lines = text.split('\n');
const markerLine = SECTIONS.map(([re]) => re ? lines.findIndex(l => re.test(l)) : 0);
markerLine.forEach((l, i) => { if (l < 0) throw new Error('marker missing ' + SECTIONS[i][1]); });
const secOfLine = ln => { let s = 0; for (let i = 0; i < markerLine.length; i++) if (ln >= markerLine[i]) s = i; return s; };

const program = ts.createProgram([SRC], { target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'], allowJs: false, noEmit: true, skipLibCheck: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext });
const checker = program.getTypeChecker();
const sf = program.getSourceFile(SRC);

// imports of engine.ts
const importSyms = new Map(); // symbol -> {name, from}
for (const st of sf.statements) if (ts.isImportDeclaration(st)) {
  const from = st.moduleSpecifier.text;
  for (const el of st.importClause.namedBindings.elements) importSyms.set(checker.getSymbolAtLocation(el.name), { name: el.name.text, from });
}
const mount = sf.statements.find(s => ts.isFunctionDeclaration(s) && s.name && s.name.text === 'mountEngine');
const body = mount.body.statements.filter(s => !(ts.isIfStatement(s) && s.getText().startsWith('if (mounted)')) && !(ts.isExpressionStatement(s) && s.getText() === 'mounted = true;'));

// 1. collect top-level declarations
const top = new Map(); // symbol -> {name, sec, kind}
const units = body.map(st => ({ st, sec: secOfLine(sf.getLineAndCharacterOfPosition(st.getStart()).line) }));
for (const u of units) {
  const st = u.st;
  if (ts.isFunctionDeclaration(st)) top.set(checker.getSymbolAtLocation(st.name), { name: st.name.text, sec: u.sec, kind: 'func' });
  else if (ts.isVariableStatement(st)) {
    const isLet = !(st.declarationList.flags & ts.NodeFlags.Const);
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) throw new Error('binding pattern at ' + st.getText().slice(0, 80));
      top.set(checker.getSymbolAtLocation(d.name), { name: d.name.text, sec: u.sec, kind: isLet ? 'let' : 'const', decl: d });
    }
  }
}
const symOf = id => {
  if (ts.isShorthandPropertyAssignment(id.parent) && id.parent.name === id) return checker.getShorthandAssignmentValueSymbol(id.parent);
  return checker.getSymbolAtLocation(id);
};
const refsIn = node => { const out = []; const walk = n => { if (ts.isIdentifier(n)) { const s = symOf(n); if (s && (top.has(s) || importSyms.has(s))) out.push({ id: n, s }); } ts.forEachChild(n, walk); }; walk(node); return out; };
// 2. decide which consts are state
for (const [s, info] of top) {
  if (info.kind !== 'const') continue;
  const init = info.decl.initializer;
  if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) { info.kind = 'fconst'; continue; }
  const deps = refsIn(init).filter(r => top.has(r.s) && r.s !== s);
  if (deps.length || /\bdocument\b/.test(init.getText())) info.kind = 'state';
  else info.kind = 'pconst';
}
for (const info of top.values()) if (info.kind === 'let') info.kind = 'state';
// a whole const statement becomes state if any member is state
for (const u of units) if (ts.isVariableStatement(u.st)) {
  const infos = u.st.declarationList.declarations.map(d => top.get(checker.getSymbolAtLocation(d.name)));
  if (infos.some(i => i.kind === 'state')) infos.forEach(i => i.kind = 'state');
}
const isState = s => top.has(s) && top.get(s).kind === 'state';

// 3. rewrite text of a node range, recording imports
function rewrite(node, mod, skipIds = new Set()) {
  const start = node.getFullStart(), src = node.getFullText();
  const edits = [];
  for (const r of refsIn(node)) {
    if (skipIds.has(r.id)) continue;
    if (importSyms.has(r.s)) { const im = importSyms.get(r.s); mod.ext.set(im.name, im.from); continue; }
    const info = top.get(r.s);
    if (info.kind === 'state') {
      mod.usesState = true;
      const sh = ts.isShorthandPropertyAssignment(r.id.parent) && r.id.parent.name === r.id;
      edits.push([r.id.getStart() - start, r.id.getEnd() - start, sh ? `${info.name}: ${ST}.${info.name}` : `${ST}.${info.name}`]);
    } else if (info.sec !== mod.sec) mod.imp.set(info.name, SECTIONS[info.sec][1]);
  }
  edits.sort((a, b) => b[0] - a[0]);
  let out = src; for (const [a, b, t] of edits) out = out.slice(0, a) + t + out.slice(b);
  return out;
}
const mods = SECTIONS.map((s, i) => ({ sec: i, name: s[1], decls: [], init: [], imp: new Map(), ext: new Map(), usesState: false }));
const stateFields = [];
for (const u of units) {
  const st = u.st, mod = mods[u.sec];
  if (ts.isFunctionDeclaration(st)) { mod.decls.push('export ' + rewrite(st, mod).replace(/^\s+/, m => m.replace(/[^\n]*$/, ''))); continue; }
  if (ts.isVariableStatement(st)) {
    const decls = st.declarationList.declarations, info0 = top.get(checker.getSymbolAtLocation(decls[0].name));
    if (info0.kind === 'state') {
      for (const d of decls) {
        const nm = d.name.text; stateFields.push({ name: nm, sec: u.sec, init: d.initializer ? d.initializer.getText().slice(0, 60) : '' });
        mod.usesState = true;
        mod.init.push(`${ST}.${nm} = ${d.initializer ? rewrite(d.initializer, mod).trim() : 'undefined'};`);
      }
      continue;
    }
    mod.decls.push('export ' + rewrite(st, mod).replace(/^\s+/, m => m.replace(/[^\n]*$/, '')));
    continue;
  }
  mod.init.push(rewrite(st, mod).replace(/^\s*\n/, '').replace(/^\s+/, ''));
}
// 4. emit modules
const tag = n => n.replace(/-(.)/g, (_, c) => c.toUpperCase());
for (const m of mods) {
  if (m.name === 'boot') continue;
  const hdr = ['// Generated from the preview engine by tools/split-engine.cjs, then maintained by hand.'];
  if (m.usesState) hdr.push(`import { ${ST} } from './state';`);
  const byFrom = new Map(); for (const [n, f] of m.ext) { if (!byFrom.has(f)) byFrom.set(f, []); byFrom.get(f).push(n); }
  for (const [f, ns] of byFrom) hdr.push(`import { ${ns.sort().join(', ')} } from '${f}';`);
  const byMod = new Map(); for (const [n, f] of m.imp) { if (!byMod.has(f)) byMod.set(f, []); byMod.get(f).push(n); }
  for (const [f, ns] of [...byMod].sort()) hdr.push(`import { ${ns.sort().join(', ')} } from './${f}';`);
  let out = hdr.join('\n') + '\n\n' + m.decls.join('\n').trim() + '\n';
  if (m.init.length) out += `\n/** Runs once at mount, in the original top-to-bottom order of the preview. */\nexport function init${tag(m.name[0].toUpperCase() + m.name.slice(1))}() {\n` + m.init.map(s => s.split('\n').map(l => '  ' + l).join('\n')).join('\n') + '\n}\n';
  m.hasInit = m.init.length > 0;
  fs.writeFileSync(path.join(OUT, m.name + '.ts'), out);
}
// boot -> index.ts
const boot = mods.find(m => m.name === 'boot');
const order = mods.filter(m => m.hasInit && m.name !== 'boot');
const idx = [`// Canvas engine entry: attaches to the DOM rendered by <Shell/>.`];
if (boot.usesState) idx.push(`import { ${ST} } from './state';`);
for (const m of order) idx.push(`import { init${tag(m.name[0].toUpperCase() + m.name.slice(1))} } from './${m.name}';`);
const bm = new Map(); for (const [n, f] of boot.imp) { if (!bm.has(f)) bm.set(f, []); bm.get(f).push(n); }
for (const [f, ns] of bm) idx.push(`import { ${ns.sort().join(', ')} } from './${f}';`);
idx.push('', 'let mounted = false;', '', '/** Safe to call twice (React StrictMode). */', 'export function mountEngine(): void {', '  if (mounted) return;', '  mounted = true;');
for (const m of order) idx.push(`  init${tag(m.name[0].toUpperCase() + m.name.slice(1))}();`);
idx.push(...boot.init.map(s => '  ' + s.trim()), '}', '');
fs.writeFileSync(path.join(OUT, 'index.ts'), idx.join('\n'));
// state.ts
const st = [`// Shared mutable editor state. Every former top-level \`let\` of the preview lives here.`, `// Initial values are assigned by each module's init function (see index.ts).`, `export interface EngineState {`];
for (const f of stateFields) st.push(`  /** ${SECTIONS[f.sec][1]}${f.init ? ': ' + f.init.replace(/\*\//g, '* /').replace(/\n.*/s, '…') : ''} */\n  ${f.name}: any;`);
st.push('}', '', `export const ${ST} = {} as EngineState;`, '');
fs.writeFileSync(path.join(OUT, 'state.ts'), st.join('\n'));
console.log('state fields:', stateFields.length, stateFields.map(f => f.name).join(' '));
console.log('modules:', mods.map(m => `${m.name}(${m.decls.length}/${m.init.length})`).join(' '));
