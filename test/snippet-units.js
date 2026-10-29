// Unit tests for routine snippets: each snippet is assembled with ACME at
// $1000, loaded into a flat 64 KB memory and its routines are called with
// the 6502 core. Called by run-tests.js (needs ACME).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { CPU } = require('./cpu6502.js');

const SN = path.join(__dirname, '..', 'snippets');

function build(acme, file) {
  const src = '        * = $1000\n' + fs.readFileSync(path.join(SN, file), 'utf8');
  const tmp = path.join(SN, '_unit_' + path.basename(file));
  const out = path.join(os.tmpdir(), 'c64ae_unit.bin');
  const sym = path.join(os.tmpdir(), 'c64ae_unit.sym');
  fs.writeFileSync(tmp, src);
  const r = cp.spawnSync(acme, ['-f', 'plain', '-o', out, '-l', sym, path.basename(tmp)], { cwd: SN, encoding: 'utf8' });
  fs.unlinkSync(tmp);
  if (r.status !== 0) throw new Error('ACME: ' + r.stdout + r.stderr);
  const labels = {};
  for (const l of fs.readFileSync(sym, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Za-z_][\w]*)\s*=\s*\$([0-9a-f]+)/i);
    if (m) labels[m[1]] = parseInt(m[2], 16);
  }
  const ram = new Uint8Array(65536);
  ram.set(fs.readFileSync(out), 0x1000);
  return { ram, labels };
}

function machine(ram) {
  const cpu = new CPU({ read: a => ram[a], write: (a, v) => { ram[a] = v; } });
  cpu.call = (addr, regs) => {
    Object.assign(cpu, { a: 0, x: 0, y: 0, d: 0, c: 0 }, regs || {});
    cpu.sp = 0xfd;
    ram[0x01ff] = 0xff; ram[0x01fe] = 0xfe;   // return address $fffe+1 -> $ffff
    cpu.sp = 0xfd;
    cpu.pc = addr;
    for (let i = 0; i < 2000000; i++) {
      if (cpu.pc === 0xffff) return cpu;
      cpu.step();
    }
    throw new Error('routine did not return');
  };
  return cpu;
}

module.exports = function run(acme, ok) {
  const w16 = (ram, a) => ram[a] | (ram[a + 1] << 8);
  const put16 = (ram, a, v) => { ram[a] = v & 0xff; ram[a + 1] = v >> 8; };
  const scr = (ram, a, n) => Array.from(ram.slice(a, a + n)).map(c => String.fromCharCode(c < 32 ? c + 64 : c)).join('');

  // ---- multiply 8 x 8
  {
    const { ram, labels: L } = build(acme, 'maths/multiply.asm');
    const cpu = machine(ram);
    let bad = [];
    for (const [a, b] of [[0, 0], [1, 1], [25, 12], [255, 255], [128, 2], [17, 0], [200, 199], [3, 85]]) {
      ram[L.mul_a] = a; ram[L.mul_b] = b;
      cpu.call(L.multiply);
      if (w16(ram, L.mul_result) !== a * b) bad.push(`${a}*${b}=${w16(ram, L.mul_result)}`);
    }
    ok(!bad.length, 'unit maths/multiply: products', bad.join(', '));
  }
  // ---- divide 16 / 16
  {
    const { ram, labels: L } = build(acme, 'maths/divide.asm');
    const cpu = machine(ram);
    let bad = [];
    for (const [a, b] of [[1000, 7], [65535, 1], [65535, 65535], [12345, 100], [5, 10], [0, 3], [49152, 256], [40000, 333]]) {
      put16(ram, L.dividend, a); put16(ram, L.divisor, b);
      cpu.call(L.divide16);
      const q = w16(ram, L.dividend), r = w16(ram, L.div_rem);
      if (q !== Math.floor(a / b) || r !== a % b) bad.push(`${a}/${b}=${q} r${r}`);
    }
    ok(!bad.length, 'unit maths/divide: quotient and remainder', bad.join(', '));
  }
  // ---- random periods
  {
    const { ram, labels: L } = build(acme, 'maths/random.asm');
    const cpu = machine(ram);
    const first8 = ram[L.seed8]; let n = 0;
    do { cpu.call(L.random8); n++; } while (ram[L.seed8] !== first8 && n < 1000);
    ok(n === 255, 'unit maths/random: 8-bit period 255', 'period ' + n);
    const first16 = w16(ram, L.seed16); n = 0;
    do { cpu.call(L.random16); n++; } while (w16(ram, L.seed16) !== first16 && n < 70000);
    ok(n === 65535, 'unit maths/random: 16-bit period 65535', 'period ' + n);
    const seen = new Set(); for (let i = 0; i < 300; i++) { cpu.call(L.random_0_9); seen.add(cpu.a); }
    ok(seen.size === 10 && [...seen].every(v => v < 10), 'unit maths/random: random_0_9 gives 0-9', [...seen].join(','));
  }
  // ---- add / sub / compare / macros
  {
    const { ram, labels: L } = build(acme, 'maths/add_sub16.asm');
    machine(ram).call(L.add16_example);
    ok(w16(ram, L.score) === 1500, 'unit maths/add_sub16: 1000 + 250 + 500 - 250', 'score ' + w16(ram, L.score));
  }
  {
    const { ram, labels: L } = build(acme, 'maths/compare16.asm');
    const cpu = machine(ram);
    cpu.call(L.limit_example);
    const a = w16(ram, L.pos_x);
    put16(ram, L.pos_x, 300); cpu.call(L.limit_example);
    ok(a === 319 && w16(ram, L.pos_x) === 300, 'unit maths/compare16: limit 400 -> 319, 300 stays', `${a}, ${w16(ram, L.pos_x)}`);
  }
  {
    const { ram, labels: L } = build(acme, 'maths/macros.asm');
    ram[0xd012] = 0xfb;
    machine(ram).call(L.macro_example);
    ok(ram[0xd020] === 0 && w16(ram, L.vector) === 0xea31 && w16(ram, L.copy) === 0xea31 && w16(ram, L.counter) === 0x00ff,
      'unit maths/macros: poke, poke16, mov16, inc16, dec16', `vector ${w16(ram, L.vector).toString(16)} counter ${w16(ram, L.counter).toString(16)}`);
  }
  // ---- memcopy / memfill (more than 256 bytes)
  {
    const { ram, labels: L } = build(acme, 'maths/memcopy.asm');
    const cpu = machine(ram);
    for (let i = 0; i < 1000; i++) ram[0x4000 + i] = (i * 7) & 0xff;
    put16(ram, L.mc_src, 0x4000); put16(ram, L.mc_dst, 0x5000); put16(ram, L.mc_len, 1000);
    cpu.call(L.memcopy);
    let same = true; for (let i = 0; i < 1000; i++) if (ram[0x5000 + i] !== ram[0x4000 + i]) same = false;
    ok(same && ram[0x5000 + 1000] === 0, 'unit maths/memcopy: 1000 bytes copied, not more');
    put16(ram, L.mc_dst, 0x6000); put16(ram, L.mc_len, 300);
    cpu.call(L.memfill, { a: 0xaa });
    ok(ram[0x6000] === 0xaa && ram[0x6000 + 299] === 0xaa && ram[0x6000 + 300] === 0, 'unit maths/memcopy: memfill 300 bytes');
  }
  // ---- number output
  {
    const { ram, labels: L } = build(acme, 'text/print_numbers.asm');
    const cpu = machine(ram);
    const at = (fn, regs, n) => { put16(ram, L.num_ptr, 0x0400); ram.fill(32, 0x0400, 0x0410); cpu.call(L[fn], regs); return scr(ram, 0x0400, n); };
    const res = [at('print_hex8', { a: 0x3f }, 2), at('print_hex16', { a: 0x00, x: 0xc0 }, 4), at('print_dec8', { a: 63 }, 3),
      at('print_dec8', { a: 255 }, 3), at('print_dec16', { a: 0x00, x: 0xc0 }, 5), at('print_dec16', { a: 0xff, x: 0xff }, 5), at('print_bin8', { a: 0x3f }, 8)];
    const want = ['3F', 'C000', '063', '255', '49152', '65535', '00111111'];
    ok(JSON.stringify(res) === JSON.stringify(want), 'unit text/print_numbers: hex, dec, bin', res.join(' '));
  }
  // ---- print_at
  {
    const { ram, labels: L } = build(acme, 'text/print_at.asm');
    const cpu = machine(ram);
    [8, 5, 12, 12, 15, 0].forEach((c, i) => { ram[0x3000 + i] = c; });      // "hello" + 0
    put16(ram, L.pa_text, 0x3000);
    cpu.call(L.print_at, { x: 10, y: 5, a: 7 });
    const p = 0x0400 + 10 * 40 + 5;
    ok(scr(ram, p, 5) === 'HELLO' && ram[0xd800 + 10 * 40 + 5] === 7 && ram[0xd800 + 10 * 40 + 9] === 7 && ram[p + 5] === 0,
      'unit text/print_at: text and colour at row 10, column 5', scr(ram, p, 6));
  }
  // ---- joystick decode
  {
    const { ram, labels: L } = build(acme, 'input/joystick.asm');
    const cpu = machine(ram);
    ram[0xdc00] = 0xff ^ (4 | 2 | 16);      // left + down + fire
    cpu.call(L.read_joy2);
    const r1 = [ram[L.joy_dx], ram[L.joy_dy], ram[L.joy_fire], ram[L.joy_press]];
    cpu.call(L.read_joy2);                  // still held: no new press
    const r2 = ram[L.joy_press];
    ram[0xdc00] = 0xff ^ 1; cpu.call(L.read_joy2);   // up, fire released
    const r3 = [ram[L.joy_dx], ram[L.joy_dy], ram[L.joy_fire], ram[L.joy_press]];
    ok(JSON.stringify(r1) === '[255,1,1,1]' && r2 === 0 && JSON.stringify(r3) === '[0,255,0,0]', 'unit input/joystick: directions and new presses',
      JSON.stringify([r1, r2, r3]));
  }
  // ---- sprite X 0-511
  {
    const { ram, labels: L } = build(acme, 'sprites/sprite_x16.asm');
    const cpu = machine(ram);
    put16(ram, L.spr_x, 300); cpu.call(L.set_sprite_x, { x: 3 });
    const a = [ram[0xd006], ram[0xd010]];
    put16(ram, L.spr_x, 100); cpu.call(L.set_sprite_x, { x: 3 });
    ok(a[0] === 44 && a[1] === 8 && ram[0xd006] === 100 && ram[0xd010] === 0, 'unit sprites/sprite_x16: bit 8 set and cleared', JSON.stringify([a, ram[0xd006], ram[0xd010]]));
  }
  // ---- fade
  {
    const { ram, labels: L } = build(acme, 'effects/fade.asm');
    const cpu = machine(ram);
    for (let i = 0; i < 1000; i++) ram[0xd800 + i] = i & 15;
    ram[0xd020] = 1; ram[0xd021] = 14;
    for (let s = 0; s < 8; s++) cpu.call(L.fade_step);
    let black = ram[0xd020] === 0 && ram[0xd021] === 0;
    for (let i = 0; i < 1000; i++) if (ram[0xd800 + i] & 15) black = false;
    ok(black, 'unit effects/fade: everything black after 8 steps');
  }
  // ---- plot / unplot
  {
    const { ram, labels: L } = build(acme, 'graphics/plot.asm');
    const cpu = machine(ram);
    put16(ram, L.plot_x, 300); cpu.call(L.plot, { y: 100 });
    const a = 0x2000 + 12 * 320 + 37 * 8 + 4;
    const set = ram[a];
    put16(ram, L.plot_x, 0); cpu.call(L.plot, { y: 0 });
    put16(ram, L.plot_x, 319); cpu.call(L.plot, { y: 199 });
    const corners = [ram[0x2000], ram[0x2000 + 24 * 320 + 39 * 8 + 7]];
    put16(ram, L.plot_x, 300); cpu.call(L.unplot, { y: 100 });
    ok(set === 0x08 && corners[0] === 0x80 && corners[1] === 0x01 && ram[a] === 0, 'unit graphics/plot: pixel (300,100), corners, unplot', JSON.stringify([set, corners, ram[a]]));
  }
  // ---- own characters
  {
    const { ram, labels: L } = build(acme, 'text/charset_copy.asm');
    put16(ram, L.cc_src, L.heart);
    machine(ram).call(L.set_char, { a: 65 });
    ok(ram[0x3000 + 65 * 8] === 0x6c && ram[0x3000 + 65 * 8 + 6] === 0x10, 'unit text/charset_copy: set_char writes 8 bytes');
  }
  // ---- clear screen
  {
    const { ram, labels: L } = build(acme, 'basics/clear_screen.asm');
    machine(ram).call(L.clear_screen, { a: 0x20, x: 5 });
    ok(ram[0x0400] === 0x20 && ram[0x0400 + 999] === 0x20 && ram[0x0400 + 1000] === 0 && ram[0xd800] === 5 && ram[0xd800 + 999] === 5,
      'unit basics/clear_screen: 1000 characters and colours');
  }
};
