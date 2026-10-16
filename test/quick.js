const A = require('../src/renderer/js/assembler.js');
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.argv[2], 'utf8');
const dir = path.dirname(path.resolve(process.argv[2]));
const io = {
  readSource(n, from) { const p = path.resolve(dir, n); return fs.existsSync(p) ? { path: p, text: fs.readFileSync(p, 'utf8') } : null; },
  binaryInfo(n, from) { const p = path.resolve(dir, n); if (!fs.existsSync(p)) return null; const b = fs.readFileSync(p); return { path: p, size: b.length, sid: A.parseSidHeader(b) }; }
};
const asm = new A.Assembler(io);
const t0 = Date.now();
const r = asm.analyze(src, path.resolve(process.argv[2]));
console.log('passes', r.passes, 'ms', Date.now() - t0);
for (const d of r.diags) console.log(`${d.severity} L${d.line + 1}:${d.col} ${d.message} | ${d.hint}`);
for (const s of r.segments) console.log('seg', s.kind, s.name, A.hex4(s.start), '-', A.hex4(s.end), (s.end - s.start) + ' bytes');
