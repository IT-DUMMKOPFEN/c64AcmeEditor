const A = require('../src/renderer/js/assembler.js');
const Z = require('../src/renderer/js/analyzer.js');
const fs = require('fs'), path = require('path');
for (const f of process.argv.slice(2)) {
  const file = path.resolve(f), dir = path.dirname(file);
  const io = {
    readSource(n) { const p = path.resolve(dir, n); return fs.existsSync(p) ? { path: p, text: fs.readFileSync(p, 'utf8') } : null; },
    binaryInfo(n) { const p = path.resolve(dir, n); if (!fs.existsSync(p)) return null; const b = fs.readFileSync(p); return { path: p, size: b.length, sid: A.parseSidHeader(b), kla: /\.kla$/.test(p) }; }
  };
  const text = fs.readFileSync(file, 'utf8');
  const r = new A.Assembler(io).analyze(text, file);
  const z = Z.analyze(r, text, file);
  console.log('==', path.basename(f), 'diags', r.diags.length, 'sanity', z.length);
  for (const d of r.diags.concat(z)) console.log(`  ${d.severity} L${d.line + 1}: ${d.message}`);
}
