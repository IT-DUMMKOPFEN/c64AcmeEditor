// Tiny C64 model for automated tests of the example programs.
// CPU + RAM/ROM banking + VIC-II (raster counter, raster IRQ, bad lines,
// line-based renderer) + CIA1 timer A / keyboard + SID register log.
// Not cycle exact - good enough to see whether an example works.
'use strict';
const fs = require('fs');
const path = require('path');
const { CPU } = require('./cpu6502.js');

const PALETTE = [
  [0, 0, 0], [255, 255, 255], [129, 51, 56], [117, 206, 200], [142, 60, 151], [86, 172, 77], [46, 44, 155], [237, 241, 113],
  [142, 80, 41], [85, 56, 0], [196, 108, 113], [74, 74, 74], [123, 123, 123], [169, 255, 159], [112, 109, 235], [178, 178, 178]
];

class C64 {
  constructor(romDir) {
    this.ram = new Uint8Array(65536);
    this.basic = fs.readFileSync(path.join(romDir, 'basic-901226-01.bin'));
    this.kernal = fs.readFileSync(path.join(romDir, 'kernal-901227-03.bin'));
    this.chargen = fs.readFileSync(path.join(romDir, 'chargen-901225-01.bin'));
    this.colorRam = new Uint8Array(1024);
    this.vic = new Uint8Array(64);
    this.vic[0x11] = 0x1b; this.vic[0x16] = 0xc8; this.vic[0x18] = 0x15;
    this.sid = new Uint8Array(32);
    this.sidLog = [];
    this.ddr = 0x2f; this.port = 0x37;
    this.cia1 = { ta: 0xffff, latch: 0xffff, cra: 0, icr: 0, mask: 0, pa: 0xff, pb: 0xff };
    this.cia2 = { pa: 0x03, ddra: 0x3f };
    this.keys = new Set();          // pressed matrix keys "col,row"
    this.line = 0; this.lineCycle = 0; this.frame = 0;
    this.lineState = new Array(312);
    this.rasterIrqLine = 0;
    this.cpu = new CPU(this);
    this.frameBuffer = null;
    this.traps = new Map();
    this.cpu.pc = this.read(0xfffc) | (this.read(0xfffd) << 8);
  }
  banks() { return (this.port | (~this.ddr & 0xff)) & 7; }
  read(a) {
    const b = this.banks();
    if (a >= 0xa000 && a < 0xc000 && (b & 3) === 3) return this.basic[a - 0xa000];
    if (a >= 0xe000 && (b & 2)) return this.kernal[a - 0xe000];
    if (a >= 0xd000 && a < 0xe000 && (b & 3)) {
      if (b & 4) return this.io(a);
      return this.chargen[a - 0xd000];
    }
    if (a === 0) return this.ddr;
    if (a === 1) return (this.port & this.ddr) | (0x17 & ~this.ddr);
    return this.ram[a];
  }
  write(a, v) {
    const b = this.banks();
    if (a === 0) { this.ddr = v; return; }
    if (a === 1) { this.port = v; return; }
    if (a >= 0xd000 && a < 0xe000 && (b & 3) && (b & 4)) return this.ioWrite(a, v);
    this.ram[a] = v;
  }
  rasterLine() { return this.line; }
  io(a) {
    if (a < 0xd400) {
      const r = a & 0x3f;
      if (r === 0x11) return (this.vic[0x11] & 0x7f) | ((this.line & 0x100) >> 1);
      if (r === 0x12) return this.line & 0xff;
      if (r === 0x19) return this.vic[0x19] | 0x70;
      if (r === 0x1e || r === 0x1f) { const v = this.vic[r]; this.vic[r] = 0; return v; }
      if (r >= 0x2f) return 0xff;
      return this.vic[r];
    }
    if (a < 0xd800) { const r = a & 0x1f; if (r === 0x1b) return Math.random() * 256 | 0; return 0; }
    if (a < 0xdc00) return this.colorRam[a - 0xd800] | 0xf0;
    if (a < 0xdd00) {
      const r = a & 0x0f, c = this.cia1;
      if (r === 0x00) return c.pa & (0xff ^ (this.joy2 || 0));  // joystick port 2 (bits 0-4, 0 = pressed)
      if (r === 0x01) return this.keyRows(c.pa) & (0xff ^ (this.joy1 || 0));
      if (r === 0x04) return c.ta & 0xff;
      if (r === 0x05) return c.ta >> 8;
      if (r === 0x0d) { const v = c.icr | ((c.icr & c.mask) ? 0x80 : 0); c.icr = 0; return v; }
      if (r === 0x0e) return c.cra;
      return 0xff;
    }
    if (a < 0xde00) {
      const r = a & 0x0f;
      if (r === 0) return this.cia2.pa | 0xc0;
      if (r === 2) return this.cia2.ddra;
      return 0xff;
    }
    return 0xff;
  }
  ioWrite(a, v) {
    if (a < 0xd400) {
      const r = a & 0x3f;
      if (r === 0x11) { this.vic[0x11] = v; this.rasterIrqLine = (this.rasterIrqLine & 0xff) | ((v & 0x80) << 1); return; }
      if (r === 0x12) { this.rasterIrqLine = (this.rasterIrqLine & 0x100) | v; return; }
      if (r === 0x19) { this.vic[0x19] &= ~v & 0x0f; return; }
      this.vic[r] = v; return;
    }
    if (a < 0xd800) { const r = a & 0x1f; this.sid[r] = v; this.sidLog.push([this.frame, this.line, r, v]); return; }
    if (a < 0xdc00) { this.colorRam[a - 0xd800] = v & 0x0f; return; }
    if (a < 0xdd00) {
      const r = a & 0x0f, c = this.cia1;
      if (r === 0x00) c.pa = v;
      else if (r === 0x04) c.latch = (c.latch & 0xff00) | v;
      else if (r === 0x05) { c.latch = (c.latch & 0xff) | (v << 8); if (!(c.cra & 1)) c.ta = c.latch; }
      else if (r === 0x0d) { if (v & 0x80) c.mask |= v & 0x1f; else c.mask &= ~v; }
      else if (r === 0x0e) { c.cra = v; if (v & 0x10) c.ta = c.latch; }
      return;
    }
    if (a < 0xde00) { const r = a & 0x0f; if (r === 0) this.cia2.pa = v; if (r === 2) this.cia2.ddra = v; }
  }
  // keyboard matrix: key = [col,row]
  keyRows(colSel) {
    let rows = 0xff;
    for (const k of this.keys) {
      const [col, row] = k.split(',').map(Number);
      if (!(colSel & (1 << col))) rows &= ~(1 << row);
    }
    return rows;
  }
  isBadline(line) {
    const d011 = this.vic[0x11];
    return (d011 & 0x10) && line >= 0x30 && line <= 0xf7 && (line & 7) === (d011 & 7);
  }
  irqPending() {
    return ((this.vic[0x19] & this.vic[0x1a] & 0x0f) !== 0) || ((this.cia1.icr & this.cia1.mask) !== 0);
  }
  runCycles(n) {
    const cpu = this.cpu;
    let left = n;
    while (left > 0) {
      const trap = this.traps.get(cpu.pc);
      if (trap) trap(this);
      const c = cpu.step();
      left -= c;
      this.tick(c);
      if (!cpu.i && this.irqPending()) { cpu.irq(0xfffe); this.tick(7); }
    }
  }
  tick(c) {
    // CIA1 timer A
    const t = this.cia1;
    if (t.cra & 1) {
      t.ta -= c;
      if (t.ta < 0) { t.ta += t.latch + 1; t.icr |= 1; if (t.cra & 8) t.cra &= ~1; }
    }
    this.lineCycle += c;
    for (;;) {
      const cap = this.curBad ? 23 : 63;
      if (this.lineCycle < cap) break;
      this.lineCycle -= cap;
      this.endLine();
    }
  }
  endLine() {
    // snapshot the state for the renderer
    this.lineState[this.line] = {
      d011: this.vic[0x11], d016: this.vic[0x16], d018: this.vic[0x18], d020: this.vic[0x20] & 15, d021: this.vic[0x21] & 15,
      d022: this.vic[0x22] & 15, d023: this.vic[0x23] & 15, bank: 3 - (this.cia2.pa & 3), bad: this.curBad
    };
    this.line++;
    if (this.line >= 312) { this.line = 0; this.frame++; this.onFrame && this.onFrame(this); }
    this.curBad = this.isBadline(this.line);
    if (this.line === this.rasterIrqLine) this.vic[0x19] |= 1;
  }
  runFrames(n) { for (let i = 0; i < n; i++) this.runCycles(312 * 63); }

  // ---- VIC memory view
  vicRead(bank, a) {
    const addr = bank * 0x4000 + (a & 0x3fff);
    if ((bank === 0 || bank === 2) && (a & 0x3000) === 0x1000) return this.chargen[a & 0x0fff];
    return this.ram[addr];
  }
  render() {
    const W = 384, H = 284, img = Buffer.alloc(W * H * 3);
    const put = (x, y, c) => { const p = (y * W + x) * 3; const rgb = PALETTE[c & 15]; img[p] = rgb[0]; img[p + 1] = rgb[1]; img[p + 2] = rgb[2]; };
    let vcbase = 0, rc = 0, idle = true;
    const first = 16;
    // vertical border flip-flop (set at line 251/247, cleared at 51/55 with DEN)
    const vborder = new Array(312);
    let vf = true;
    for (let pass = 0; pass < 2; pass++) {
      for (let line = 0; line < 312; line++) {
        const s = this.lineState[line] || this.lineState[0];
        if (s) {
          const rsel = s.d011 & 8;
          if (line === (rsel ? 251 : 247)) vf = true;
          if (line === (rsel ? 51 : 55) && (s.d011 & 0x10)) vf = false;
        }
        vborder[line] = vf;
      }
    }
    for (let line = 0; line < 312; line++) {
      const s = this.lineState[line] || this.lineState[0];
      if (!s) continue;
      const bad = s.bad;
      if (line === 0) { vcbase = 0; idle = true; }
      if (bad) { idle = false; rc = 0; }
      const y = line - first;
      if (y >= 0 && y < H) {
        const rsel = s.d011 & 8, csel = s.d016 & 8, den = s.d011 & 0x10;
        const top = rsel ? 51 : 55, bottom = rsel ? 250 : 246;
        const left = csel ? 32 : 39, right = csel ? 352 : 343;
        const bmm = s.d011 & 0x20, mcm = s.d016 & 0x10, ecm = s.d011 & 0x40;
        const bank = s.bank;
        const scr = ((s.d018 >> 4) & 15) * 0x400;
        const chr = ((s.d018 >> 1) & 7) * 0x800;
        const bmp = (s.d018 & 8) ? 0x2000 : 0;
        const xs = s.d016 & 7;
        for (let x = 0; x < W; x++) {
          let c = s.d020;
          if (!vborder[line] && x >= left && x < right) {
            c = s.d021;
            const gx = x - 32 - xs;
            if (!idle && gx >= 0 && gx < 320) {
              const col = gx >> 3, bit = 7 - (gx & 7);
              const vc = vcbase + col;
              const code = this.vicRead(bank, scr + vc);
              const cram = this.colorRam[vc & 0x3ff];
              if (bmm) {
                const byte = this.vicRead(bank, bmp + vc * 8 + rc);
                if (mcm) {
                  const pair = (byte >> ((bit & 6))) & 3;
                  c = [s.d021, code >> 4, code & 15, cram][pair];
                } else c = (byte >> bit) & 1 ? code >> 4 : code & 15;
              } else {
                const ch = ecm ? code & 63 : code;
                const byte = this.vicRead(bank, chr + ch * 8 + rc);
                if (mcm && (cram & 8)) {
                  const pair = (byte >> (bit & 6)) & 3;
                  c = [s.d021, s.d022, s.d023, cram & 7][pair];
                } else c = (byte >> bit) & 1 ? cram : (ecm ? [s.d021, s.d022, s.d023, 0][code >> 6] : s.d021);
              }
            }
          }
          put(x, y, c);
        }
      }
      if (!idle) { if (rc === 7) { vcbase += 40; idle = true; } else rc++; }
    }
    // sprites (end-of-frame registers)
    const v = this.vic, st = this.lineState[0x80] || { bank: 0, d018: 0x15 };
    const scr = ((st.d018 >> 4) & 15) * 0x400;
    for (let n = 7; n >= 0; n--) {
      if (!(v[0x15] & (1 << n))) continue;
      const sx = v[n * 2] | ((v[0x10] >> n) & 1) << 8, sy = v[n * 2 + 1];
      const ptr = this.vicRead(st.bank, scr + 0x3f8 + n) * 64;
      const ex = (v[0x1d] >> n) & 1, ey = (v[0x17] >> n) & 1, mc = (v[0x1c] >> n) & 1;
      for (let r = 0; r < 21 * (ey + 1); r++) {
        for (let px = 0; px < 24 * (ex + 1); px++) {
          const dr = ey ? r >> 1 : r, dp = ex ? px >> 1 : px;
          const byte = this.vicRead(st.bank, ptr + dr * 3 + (dp >> 3));
          let c = -1;
          if (mc) {
            const pair = (byte >> (6 - (dp & 6))) & 3;
            if (pair) c = [0, v[0x25], v[0x27 + n], v[0x26]][pair];
          } else if ((byte >> (7 - (dp & 7))) & 1) c = v[0x27 + n];
          if (c < 0) continue;
          const X = sx + px + 8, Y = sy + r + 1 - first;
          const ln = (Y + first) % 312;
          if (vborder[ln] || X < ((v[0x16] & 8) ? 32 : 39) || X >= ((v[0x16] & 8) ? 352 : 343)) continue;
          if (X >= 0 && X < W && Y >= 0 && Y < H) put(X, Y, c & 15);
        }
      }
    }
    return { W, H, img };
  }
  savePPM(file) {
    const { W, H, img } = this.render();
    fs.writeFileSync(file, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), img]));
  }
  // ---- program loading like VICE "inject to RAM" autostart
  boot() {
    // run the KERNAL reset until BASIC waits for input (READY.)
    for (let i = 0; i < 200 && !(this.cpu.pc >= 0xe5cd && this.cpu.pc <= 0xe5d6); i++) this.runFrames(1);
    this.runFrames(5);
  }
  loadPrg(file) {
    const b = fs.readFileSync(file);
    const load = b[0] | (b[1] << 8);
    for (let i = 2; i < b.length; i++) this.ram[load + i - 2] = b[i];
    const end = load + b.length - 2;
    if (load === 0x0801) { // set BASIC end pointers
      this.ram[0x2d] = end & 0xff; this.ram[0x2e] = end >> 8;
      this.ram[0x2f] = end & 0xff; this.ram[0x30] = end >> 8;
      this.ram[0x31] = end & 0xff; this.ram[0x32] = end >> 8;
    }
    return { load, end };
  }
  type(text) { // put text into the keyboard buffer
    const codes = [...text].map(ch => ch === '\n' ? 13 : ch.toUpperCase().charCodeAt(0));
    for (let i = 0; i < codes.length; i++) this.ram[0x277 + i] = codes[i];
    this.ram[0xc6] = codes.length;
  }
  screenText() {
    let out = '';
    for (let r = 0; r < 25; r++) {
      let l = '';
      for (let c = 0; c < 40; c++) {
        const code = this.ram[0x400 + r * 40 + c] & 0x7f;
        l += code === 0 ? '@' : code < 27 ? String.fromCharCode(64 + code) : code < 64 ? String.fromCharCode(code) : '#';
      }
      out += l.replace(/\s+$/, '') + '\n';
    }
    return out.replace(/\n+$/, '');
  }
}

module.exports = { C64, PALETTE };
