// Minimal NMOS 6502 core used by the test-suite to verify example programs.
// Not cycle exact (no dummy reads), but counts instruction cycles incl. page
// crossing and taken branches, which is enough for raster-polling loops.
'use strict';
const OPC = require('../src/renderer/js/opcodes.js');

class CPU {
  constructor(mem) {
    this.mem = mem; // object with read(addr) / write(addr, v)
    this.a = 0; this.x = 0; this.y = 0; this.sp = 0xff; this.pc = 0;
    this.c = 0; this.z = 0; this.i = 1; this.d = 0; this.v = 0; this.n = 0;
    this.cycles = 0;
    this.table = OPC.BY_OPCODE;
  }
  rd(a) { return this.mem.read(a & 0xffff); }
  wr(a, v) { this.mem.write(a & 0xffff, v & 0xff); }
  push(v) { this.wr(0x100 + this.sp, v); this.sp = (this.sp - 1) & 0xff; }
  pull() { this.sp = (this.sp + 1) & 0xff; return this.rd(0x100 + this.sp); }
  getP() { return (this.n << 7) | (this.v << 6) | 0x20 | (this.d << 3) | (this.i << 2) | (this.z << 1) | this.c; }
  setP(p) { this.n = (p >> 7) & 1; this.v = (p >> 6) & 1; this.d = (p >> 3) & 1; this.i = (p >> 2) & 1; this.z = (p >> 1) & 1; this.c = p & 1; }
  nz(v) { v &= 0xff; this.z = v === 0 ? 1 : 0; this.n = v >> 7; return v; }
  irq(vector) {
    this.push(this.pc >> 8); this.push(this.pc & 0xff); this.push(this.getP() & ~0x10);
    this.i = 1; this.pc = this.rd(vector) | (this.rd(vector + 1) << 8); this.cycles += 7;
  }
  step() {
    const opPc = this.pc;
    const op = this.rd(this.pc);
    const info = this.table[op];
    if (!info) throw new Error(`Unknown opcode $${op.toString(16)} at $${opPc.toString(16)}`);
    this.pc = (this.pc + 1) & 0xffff;
    let addr = null, val, pageCross = false;
    const b1 = () => { const v = this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff; return v; };
    const w = () => { const lo = b1(); return lo | (b1() << 8); };
    switch (info.mode) {
      case 'imp': case 'acc': break;
      case 'imm': addr = this.pc; this.pc = (this.pc + 1) & 0xffff; break;
      case 'zp': addr = b1(); break;
      case 'zpx': addr = (b1() + this.x) & 0xff; break;
      case 'zpy': addr = (b1() + this.y) & 0xff; break;
      case 'abs': addr = w(); break;
      case 'abx': { const b = w(); addr = (b + this.x) & 0xffff; pageCross = (b & 0xff00) !== (addr & 0xff00); break; }
      case 'aby': { const b = w(); addr = (b + this.y) & 0xffff; pageCross = (b & 0xff00) !== (addr & 0xff00); break; }
      case 'ind': { const p = w(); addr = this.rd(p) | (this.rd((p & 0xff00) | ((p + 1) & 0xff)) << 8); break; }
      case 'izx': { const z = (b1() + this.x) & 0xff; addr = this.rd(z) | (this.rd((z + 1) & 0xff) << 8); break; }
      case 'izy': { const z = b1(); const b = this.rd(z) | (this.rd((z + 1) & 0xff) << 8); addr = (b + this.y) & 0xffff; pageCross = (b & 0xff00) !== (addr & 0xff00); break; }
      case 'rel': { let o = b1(); if (o & 0x80) o -= 256; addr = (this.pc + o) & 0xffff; break; }
    }
    let cyc = info.cycles;
    if (info.extra === 'p' && pageCross) cyc++;
    const ld = () => this.rd(addr);
    const branch = (cond) => { if (cond) { cyc += ((this.pc & 0xff00) !== (addr & 0xff00)) ? 2 : 1; this.pc = addr; } };
    const adc = (m) => {
      if (this.d) {
        let lo = (this.a & 0x0f) + (m & 0x0f) + this.c; let hi = (this.a >> 4) + (m >> 4);
        if (lo > 9) { lo += 6; hi++; }
        this.z = ((this.a + m + this.c) & 0xff) === 0 ? 1 : 0;
        this.n = (hi & 8) ? 1 : 0;
        this.v = ((~(this.a ^ m) & (this.a ^ (hi << 4))) & 0x80) ? 1 : 0;
        if (hi > 9) hi += 6;
        this.c = hi > 15 ? 1 : 0;
        this.a = ((hi << 4) | (lo & 0x0f)) & 0xff;
        return;
      }
      const r = this.a + m + this.c;
      this.v = ((~(this.a ^ m) & (this.a ^ r)) & 0x80) ? 1 : 0;
      this.c = r > 0xff ? 1 : 0; this.a = this.nz(r);
    };
    const sbc = (m) => {
      if (this.d) {
        const r = this.a - m - (1 - this.c);
        let lo = (this.a & 0x0f) - (m & 0x0f) - (1 - this.c); let hi = (this.a >> 4) - (m >> 4);
        if (lo < 0) { lo -= 6; hi--; }
        if (hi < 0) hi -= 6;
        this.v = (((this.a ^ m) & (this.a ^ r)) & 0x80) ? 1 : 0;
        this.c = r >= 0 ? 1 : 0; this.nz(r);
        this.a = ((hi << 4) | (lo & 0x0f)) & 0xff; return;
      }
      const r = this.a - m - (1 - this.c);
      this.v = (((this.a ^ m) & (this.a ^ r)) & 0x80) ? 1 : 0;
      this.c = r >= 0 ? 1 : 0; this.a = this.nz(r);
    };
    const cmp = (r, m) => { const t = r - m; this.c = t >= 0 ? 1 : 0; this.nz(t); };
    const rmw = (fn) => { if (info.mode === 'acc') { this.a = fn(this.a); } else { const v = fn(this.rd(addr)); this.wr(addr, v); } };
    switch (info.mnemonic) {
      case 'LDA': this.a = this.nz(ld()); break;
      case 'LDX': this.x = this.nz(ld()); break;
      case 'LDY': this.y = this.nz(ld()); break;
      case 'STA': this.wr(addr, this.a); break;
      case 'STX': this.wr(addr, this.x); break;
      case 'STY': this.wr(addr, this.y); break;
      case 'TAX': this.x = this.nz(this.a); break;
      case 'TAY': this.y = this.nz(this.a); break;
      case 'TXA': this.a = this.nz(this.x); break;
      case 'TYA': this.a = this.nz(this.y); break;
      case 'TSX': this.x = this.nz(this.sp); break;
      case 'TXS': this.sp = this.x; break;
      case 'PHA': this.push(this.a); break;
      case 'PHP': this.push(this.getP() | 0x10); break;
      case 'PLA': this.a = this.nz(this.pull()); break;
      case 'PLP': this.setP(this.pull()); break;
      case 'AND': this.a = this.nz(this.a & ld()); break;
      case 'ORA': this.a = this.nz(this.a | ld()); break;
      case 'EOR': this.a = this.nz(this.a ^ ld()); break;
      case 'ADC': adc(ld()); break;
      case 'SBC': sbc(ld()); break;
      case 'CMP': cmp(this.a, ld()); break;
      case 'CPX': cmp(this.x, ld()); break;
      case 'CPY': cmp(this.y, ld()); break;
      case 'BIT': { const m = ld(); this.z = (this.a & m) === 0 ? 1 : 0; this.n = m >> 7; this.v = (m >> 6) & 1; break; }
      case 'INC': rmw(v => this.nz(v + 1)); break;
      case 'DEC': rmw(v => this.nz(v - 1)); break;
      case 'INX': this.x = this.nz(this.x + 1); break;
      case 'INY': this.y = this.nz(this.y + 1); break;
      case 'DEX': this.x = this.nz(this.x - 1); break;
      case 'DEY': this.y = this.nz(this.y - 1); break;
      case 'ASL': rmw(v => { this.c = v >> 7; return this.nz(v << 1); }); break;
      case 'LSR': rmw(v => { this.c = v & 1; return this.nz(v >> 1); }); break;
      case 'ROL': rmw(v => { const c = this.c; this.c = v >> 7; return this.nz((v << 1) | c); }); break;
      case 'ROR': rmw(v => { const c = this.c; this.c = v & 1; return this.nz((v >> 1) | (c << 7)); }); break;
      case 'JMP': this.pc = addr; break;
      case 'JSR': { const r = (this.pc - 1) & 0xffff; this.push(r >> 8); this.push(r & 0xff); this.pc = addr; break; }
      case 'RTS': { const lo = this.pull(); const hi = this.pull(); this.pc = (((hi << 8) | lo) + 1) & 0xffff; break; }
      case 'RTI': { this.setP(this.pull()); const lo = this.pull(); const hi = this.pull(); this.pc = (hi << 8) | lo; break; }
      case 'BRK': { this.pc = (this.pc + 1) & 0xffff; this.push(this.pc >> 8); this.push(this.pc & 0xff); this.push(this.getP() | 0x10); this.i = 1; this.pc = this.rd(0xfffe) | (this.rd(0xffff) << 8); break; }
      case 'BCC': branch(!this.c); break; case 'BCS': branch(this.c); break;
      case 'BEQ': branch(this.z); break; case 'BNE': branch(!this.z); break;
      case 'BMI': branch(this.n); break; case 'BPL': branch(!this.n); break;
      case 'BVC': branch(!this.v); break; case 'BVS': branch(this.v); break;
      case 'CLC': this.c = 0; break; case 'SEC': this.c = 1; break;
      case 'CLI': this.i = 0; break; case 'SEI': this.i = 1; break;
      case 'CLD': this.d = 0; break; case 'SED': this.d = 1; break;
      case 'CLV': this.v = 0; break; case 'NOP': break;
      case 'LAX': this.a = this.x = this.nz(ld()); break;
      case 'SAX': this.wr(addr, this.a & this.x); break;
      default: throw new Error(`Opcode ${info.mnemonic} not emulated (at $${opPc.toString(16)})`);
    }
    this.cycles += cyc;
    return cyc;
  }
}

module.exports = { CPU };
