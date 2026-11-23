// For "Expected N arguments, but got M": mark the callee's trailing parameters optional,
// matching how the preview (plain JS) calls them.
const ts = require('/home/claude/Flowspace/node_modules/typescript'), fs = require('fs'), path = require('path');
const root = '/home/claude/Flowspace';
const cfg = ts.getParsedCommandLineOfConfigFile(path.join(root, 'tsconfig.app.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
const prog = ts.createProgram(cfg.fileNames, cfg.options); const ch = prog.getTypeChecker();
const edits = new Map(); let n = 0;
for (const d of ts.getPreEmitDiagnostics(prog)) {
  if (d.code !== 2554) continue;
  const find = (node) => { let hit; const w = x => { if (x.getStart() <= d.start && d.start < x.getEnd()) { if (ts.isCallExpression(x)) hit = x; ts.forEachChild(x, w); } }; w(node); return hit; };
  const call = find(d.file); if (!call) continue;
  const sig = ch.getResolvedSignature(call); const decl = sig && sig.declaration; if (!decl) continue;
  const f = decl.getSourceFile().fileName; if (!edits.has(f)) edits.set(f, new Map());
  decl.parameters.forEach((p, i) => { if (i >= call.arguments.length && !p.initializer && !p.questionToken && !p.dotDotDotToken) edits.get(f).set(p.name.getEnd(), '?'); });
  n++;
}
for (const [f, m] of edits) { let s = fs.readFileSync(f, 'utf8'); for (const pos of [...m.keys()].sort((a, b) => b - a)) s = s.slice(0, pos) + '?' + s.slice(pos); fs.writeFileSync(f, s); }
console.log('fixed calls', n);
