// Compares the JS model with the real ACME (segments + error lines)
const A = require('../src/renderer/js/assembler.js');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ACME = process.env.ACME || 'acme';
let fails = 0;
for (const f of process.argv.slice(2)) {
  const file = path.resolve(f), dir = path.dirname(file);
  const io = {
    readSource(n) { const p = path.resolve(dir, n); return fs.existsSync(p) ? { path: p, text: fs.readFileSync(p, 'utf8') } : null; },
    binaryInfo(n) { const p = path.resolve(dir, n); if (!fs.existsSync(p)) return null; const b = fs.readFileSync(p); return { path: p, size: b.length, sid: A.parseSidHeader(b) }; }
  };
  const r = new A.Assembler(io).analyze(fs.readFileSync(file, 'utf8'), file);
  const out = path.join(require('os').tmpdir(), 'cmp_' + path.basename(f) + '.prg');
  const res = cp.spawnSync(ACME, ['-v2', '-f', 'cbm', '-o', out, path.basename(file)], { cwd: dir, encoding: 'utf8' });
  const text = (res.stdout || '') + (res.stderr || '');
  const acmeSegs = [...text.matchAll(/Segment size is \d+ \(0x[0-9a-f]+\) bytes \(0x([0-9a-f]+) - 0x([0-9a-f]+) exclusive\)/g)].map(m => [parseInt(m[1], 16), parseInt(m[2], 16)]);
  const acmeErr = [...text.matchAll(/(Error|Warning|Serious error) - File (.*?), line (\d+).*?: (.*)/g)].map(m => `${m[1]} L${m[3]}: ${m[4]}`);
  // ACME prints segments of the last pass only; take the last N where N = count printed in final pass
  const jsSegs = mergeAll(r.ranges);
  const ac = mergeAll(acmeSegs.map(([s, e]) => ({ start: s, end: e })).slice(-countFinal(text)));
  const ok = JSON.stringify(jsSegs) === JSON.stringify(ac);
  const jsErr = r.diags.filter(d => d.severity === 'error').map(d => `L${d.line + 1}: ${d.message}`);
  console.log(`${ok ? 'OK  ' : 'DIFF'} ${path.basename(f)}  js=${fmt(jsSegs)}  acme=${fmt(ac)}  passes=${r.passes}`);
  if (acmeErr.length || jsErr.length) { console.log('   ACME:', acmeErr.join(' | ') || '-'); console.log('   JS  :', jsErr.join(' | ') || '-'); }
  if (!ok || (acmeErr.some(e => e.startsWith('Error')) !== jsErr.length > 0)) fails++;
}
function countFinal(text) {
  const parts = text.split(/First pass\.|Further pass\.|Extra pass needed to find error\./);
  const last = parts[parts.length - 1];
  return (last.match(/Segment size/g) || []).length || 99;
}
function mergeAll(list) {
  const s = list.map(r => [r.start, r.end]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of s) { const l = out[out.length - 1]; if (l && a <= l[1]) l[1] = Math.max(l[1], b); else out.push([a, b]); }
  return out;
}
function fmt(s) { return s.map(([a, b]) => a.toString(16) + '-' + b.toString(16)).join(','); }
process.exit(fails ? 1 : 0);
