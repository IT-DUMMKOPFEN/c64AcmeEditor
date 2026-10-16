// Test suite: the JS assembler model must agree with the real ACME on all
// examples, find typical mistakes and keep the sanity check quiet on good code.
// Usage: ACME=/path/to/acme node test/run-tests.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const A = require('../src/renderer/js/assembler.js');
const Z = require('../src/renderer/js/analyzer.js');
const ACME = process.env.ACME || 'acme';
const EX = path.join(__dirname, '..', 'examples');
let failed = 0, passed = 0;
const ok = (cond, name, detail) => { if (cond) { passed++; console.log('  ok   ' + name); } else { failed++; console.log('  FAIL ' + name + (detail ? '\n       ' + detail : '')); } };

function model(file, text) {
  const dir = path.dirname(file);
  const io = {
    readSource(n) { const p = path.resolve(dir, n); return fs.existsSync(p) ? { path: p, text: fs.readFileSync(p, 'utf8') } : null; },
    binaryInfo(n) { const p = path.resolve(dir, n); if (!fs.existsSync(p)) return null; const b = fs.readFileSync(p); return { path: p, size: b.length, sid: A.parseSidHeader(b), kla: /\.kla$/i.test(p) }; }
  };
  return new A.Assembler(io).analyze(text == null ? fs.readFileSync(file, 'utf8') : text, file);
}
function merge(list) {
  const s = list.map(r => [r.start, r.end]).sort((a, b) => a[0] - b[0]); const out = [];
  for (const [a, b] of s) { const l = out[out.length - 1]; if (l && a <= l[1]) l[1] = Math.max(l[1], b); else out.push([a, b]); }
  return JSON.stringify(out);
}
const haveAcme = (() => { try { return cp.spawnSync(ACME, ['-V']).status === 0; } catch (e) { return false; } })();
console.log(haveAcme ? 'ACME: ' + ACME : 'ACME not found - comparing with ACME is skipped');

console.log('\n# examples');
const files = fs.readdirSync(EX).filter(f => f.endsWith('.asm')).map(f => path.join(EX, f)).concat([path.join(EX, 'music', 'demo_tune_src.asm')]);
for (const f of files) {
  const name = path.relative(EX, f);
  const r = model(f);
  ok(!r.diags.some(d => d.severity === 'error'), name + ': no errors in the model', r.diags.map(d => d.message).join('; '));
  const z = Z.analyze(r, fs.readFileSync(f, 'utf8'), f);
  ok(!z.some(d => d.severity !== 'info'), name + ': sanity check without warnings', z.filter(d => d.severity !== 'info').map(d => d.message).join('; '));
  if (haveAcme) {
    const out = path.join(os.tmpdir(), 'c64ae_test_' + path.basename(f) + '.prg');
    const res = cp.spawnSync(ACME, ['-v2', '-f', 'cbm', '-o', out, path.basename(f)], { cwd: path.dirname(f), encoding: 'utf8' });
    const text = (res.stdout || '') + (res.stderr || '');
    ok(res.status === 0, name + ': ACME assembles it', text.split('\n').filter(l => /Error/.test(l)).join(' | '));
    const parts = text.split(/First pass\.|Further pass\.|Extra pass needed to find error\./);
    void parts;
    const segs = [...text.matchAll(/Segment size is .*?\(0x([0-9a-f]+) - 0x([0-9a-f]+) exclusive\)/g)].map(m => ({ start: parseInt(m[1], 16), end: parseInt(m[2], 16) }));
    ok(merge(segs) === merge(r.ranges), name + ': memory layout matches ACME', 'acme=' + merge(segs) + ' model=' + merge(r.ranges));
  }
}

console.log('\n# error detection');
const cases = [
  ['sta #4', /does not support immediate/],
  ['ldq #5', /Unknown mnemonic 'ldq'/],
  ['lda #$100', /out of range/],
  ['ldx $10,x', /indexing with X/],
  ['lda ($fb)', /indirect addressing without index/],
  ['jsr nowhere', /Value not defined \(nowhere\)/],
  ['inx $10', /takes no operand/],
  ['asl a', /does not accept 'asl a'/],
  ['!bytes 1', /Unknown pseudo opcode/],
  ['.byte 1', /not ACME syntax/],
  ['lax $10', /illegal\) opcode/],
  ['lda "x', /Quotes still open/],
  ['beq far\n!fill 200\nfar rts', /out of range/],
  ['!for i, 0, 3 {\nnop', /never closed/],
  ['+undefined_macro 1', /Macro 'undefined_macro' is not defined/],
  ['lda 10h', /Invalid number '10h'/]
];
for (const [src, re] of cases) {
  const text = '        * = $1000\n' + src.split('\n').map(l => /^(far|start)/.test(l) ? l : '        ' + l).join('\n') + '\n';
  const r = model(path.join(os.tmpdir(), 'case.asm'), text);
  ok(r.diags.some(d => re.test(d.message)), JSON.stringify(src) + ' -> ' + re, r.diags.map(d => d.message).join('; ') || 'no message');
}

console.log('\n# sanity check');
const sanity = [
  ['        * = $0801\n        !word +, 10\n        !byte $9e\n        !text "2064"\n        !byte 0\n+       !word 0\nstart   rts\n', /SYS 2064/],
  ['        * = $c000\n        sei\n        lda #1\n        sta $d01a\n        cli\n        rts\n', /never acknowledged/],
  ['        * = $c000\n        sed\n        rts\n', /SED/],
  ['        * = $c000\n        rts\n        lda #1\n        rts\n', /never be reached/],
  ['        * = $a000\n        rts\n', /BASIC ROM/]
];
for (const [text, re] of sanity) {
  const f = path.join(os.tmpdir(), 'sanity.asm');
  const r = model(f, text);
  const z = Z.analyze(r, text, f);
  ok(z.some(d => re.test(d.message)), 'sanity ' + re, z.map(d => d.message).join('; ') || 'no message');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
