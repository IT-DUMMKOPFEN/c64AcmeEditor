/*
 * C64 ACME EDITOR - sanity check ("does this program make sense?")
 * (c) IT-Dummköpfe - MIT License
 *
 * Works on the result of C64Asm.Assembler.analyze() and looks for things that
 * assemble fine but will probably not work on a real C64.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./assembler.js'));
  else root.C64Analyzer = factory(root.C64Asm);
})(typeof self !== 'undefined' ? self : this, function (Asm) {
  'use strict';
  const h4 = Asm.hex4;

  function analyze(r, text, mainPath) {
    const out = [];
    const add = (severity, loc, message, hint) => out.push({
      severity, file: loc ? loc.file : mainPath, line: loc ? loc.line : 0, col: loc ? loc.col : 0,
      endCol: loc ? loc.endCol : 1, message, hint: hint || '', source: 'sanity'
    });
    const instrs = r.instrs || [];
    const writes = (addr) => instrs.filter(i => ['STA', 'STX', 'STY', 'INC', 'DEC', 'ASL', 'LSR', 'ROL', 'ROR', 'SAX', 'DCP', 'ISC', 'SLO', 'RLA', 'SRE', 'RRA'].includes(i.mn) &&
      i.value === addr && ['zp', 'abs', 'abx', 'aby', 'zpx', 'zpy'].includes(i.mode) && (i.mode === 'zp' || i.mode === 'abs'));
    const writesRange = (lo, hi) => instrs.filter(i => ['STA', 'STX', 'STY'].includes(i.mn) && i.value != null && i.value >= lo && i.value <= hi && (i.mode === 'abs' || i.mode === 'zp'));
    const writesPort = writes(0x01).length > 0;

    // ---------------------------------------------------------- nothing there
    if (!r.ranges || !r.ranges.length) {
      add('info', null, 'The program produces no bytes yet.', 'Start with "* = $0801" and a BASIC start line (Edit > Insert > BASIC Start Line).');
      return out;
    }

    // ---------------------------------------------------------- overlaps
    const rs = r.ranges.slice().sort((a, b) => a.start - b.start);
    for (let i = 1; i < rs.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = rs[j], b = rs[i];
        if (b.start < a.end && b.end > a.start) {
          const lo = Math.max(a.start, b.start), hi = Math.min(a.end, b.end) - 1;
          add('error', { file: b.file, line: b.line, col: 0, endCol: 1 },
            `Memory overlap ${h4(lo)}-${h4(hi)}: this part overwrites ${a.name || a.tag} from line ${a.line + 1}.`,
            'Two segments use the same memory. Move one with "* = address", or relocate a SID with Tools > Relocate SID.');
        }
      }
    }

    // ---------------------------------------------------------- memory areas
    const plain = (r.outputs || []).some(o => o.format === 'plain');
    const merged = [];
    for (const x of rs) {
      const l = merged[merged.length - 1];
      if (l && x.start <= l.end) l.end = Math.max(l.end, x.end);
      else merged.push({ start: x.start, end: x.end, file: x.file, line: x.line });
    }
    const touched = (lo, hi) => plain ? [] : merged.filter(x => x.start <= hi && x.end - 1 >= lo);
    for (const x of touched(0x0000, 0x00ff)) add('warning', locOf(x), `Data in the zero page (${h4(Math.max(x.start, 0))}...).`, 'The zero page is used by the CPU port ($00/$01), BASIC and the KERNAL. Only use free locations like $02, $fb-$fe, or switch off BASIC/KERNAL.');
    for (const x of touched(0x0100, 0x01ff)) add('warning', locOf(x), 'Data in the stack area $0100-$01FF.', 'JSR, interrupts and PHA use this memory - your data will be overwritten.');
    for (const x of touched(0x0200, 0x03ff)) add('info', locOf(x), `Data in the KERNAL work area $0200-$03FF (${h4(Math.max(x.start, 0x200))}...).`, 'Important vectors live here (e.g. $0314 IRQ). Only $0334-$03FF (cassette buffer) is fairly safe.');
    for (const x of touched(0x0400, 0x07e7)) add('info', locOf(x), 'Data in the default screen memory $0400-$07E7.', 'It is visible as characters and gets overwritten when the screen is cleared or scrolled.');
    for (const x of touched(0xa000, 0xbfff)) {
      if (!writesPort) add('warning', locOf(x), `Data under the BASIC ROM (${h4(Math.max(x.start, 0xa000))}-${h4(Math.min(x.end - 1, 0xbfff))}).`,
        'Loading works, but the CPU reads the ROM there. Switch the BASIC ROM off first, e.g. "lda #$36 : sta $01".');
    }
    for (const x of touched(0xd000, 0xdfff)) add('warning', locOf(x), `Data in the I/O area ${h4(Math.max(x.start, 0xd000))}-${h4(Math.min(x.end - 1, 0xdfff))}.`,
      'Here are VIC-II, SID, colour RAM and the CIAs. A program loaded here overwrites the chips (or the RAM below when I/O is off). Usually a mistake.');
    for (const x of touched(0xe000, 0xffff)) {
      if (!writesPort) add('warning', locOf(x), `Data under the KERNAL ROM (${h4(Math.max(x.start, 0xe000))}-${h4(Math.min(x.end - 1, 0xffff))}).`,
        'The CPU reads the KERNAL there. Switch it off with "lda #$35 : sta $01" (and set your own IRQ vector at $FFFE).');
    }

    // ---------------------------------------------------------- big gaps
    if (rs.length > 1 && !plain) {
      const start = Math.min(...rs.map(x => x.start)), end = Math.max(...rs.map(x => x.end));
      const used = rs.reduce((n, x) => n + (x.end - x.start), 0);
      const gap = end - start - used;
      if (gap > 4096) add('info', null, `The PRG file will be ${end - start + 2} bytes long, ${gap} of them are empty gaps between the segments.`,
        'That is normal for demos (music at $1000, graphics at $2000 ...). Pack the PRG with Exomizer when saving to make it small again.');
    }

    // ---------------------------------------------------------- BASIC start line
    const lines = text.split(/\r?\n/);
    const starts0801 = (r.pcStatements || []).find(p => p.addr === 0x0801 && p.loc.file === mainPath);
    if (starts0801) {
      const firstInstr = instrs.find(i => i.addr >= 0x0801 && i.loc.file === mainPath);
      const firstAt0801 = instrs.find(i => i.addr === 0x0801);
      if (firstAt0801) {
        add('warning', firstAt0801.loc, 'Code starts directly at $0801 - without a BASIC start line RUN will not work.',
          'Add a BASIC line like "10 SYS 2061" in front of your code (Edit > Insert > BASIC Start Line), or start it with SYS 2049.');
      } else if (firstInstr) {
        const sysLine = findSys(lines, starts0801.loc.line);
        if (sysLine && sysLine.addr !== firstInstr.addr && !labelAt(r, sysLine.addr)) {
          add('error', { file: mainPath, line: sysLine.line, col: 0, endCol: 1 },
            `SYS ${sysLine.addr} jumps to ${h4(sysLine.addr)}, but the first instruction is at ${h4(firstInstr.addr)} (${firstInstr.addr}).`,
            `Change the number in the BASIC line to "${firstInstr.addr}", or move your code.`);
        }
      }
    }

    // ---------------------------------------------------------- !to
    if (!r.outputs || !r.outputs.length) add('info', null, 'No "!to" in the source.', 'The editor names the PRG after the source file. Add e.g. !to "demo.prg", cbm to choose a name.');

    // ---------------------------------------------------------- unreachable code
    const targets = new Set();
    for (const s of r.symbolMap ? r.symbolMap.values() : []) if (s.isLabel && s.def) targets.add(s.v);
    (r.anonAddrs || []).forEach(a => targets.add(a));
    instrs.forEach(i => { if (i.value != null && (i.mode === 'rel' || i.mn === 'JMP' || i.mn === 'JSR')) targets.add(i.value); });
    const sorted = instrs.slice().sort((a, b) => a.addr - b.addr);
    for (let k = 0; k < sorted.length - 1; k++) {
      const a = sorted[k], b = sorted[k + 1];
      if (!['RTS', 'RTI', 'JMP'].includes(a.mn)) continue;
      if (b.addr !== a.addr + a.size) continue;               // data in between
      if (targets.has(b.addr)) continue;
      if (a.loc.file !== b.loc.file) continue;
      add('warning', b.loc, `This instruction can never be reached (it follows ${a.mn.toLowerCase()} and no label points here).`,
        'Add a label if other code jumps here, or remove the code.');
    }

    // ---------------------------------------------------------- interrupts
    const vec314 = writes(0x0314).concat(writes(0x0315));
    const vecFFFE = writes(0xfffe).concat(writes(0xffff));
    const seiList = instrs.filter(i => i.mn === 'SEI');
    const firstVec = vec314.concat(vecFFFE).sort((a, b) => a.addr - b.addr)[0];
    if (firstVec && !seiList.some(s => s.addr < firstVec.addr)) {
      add('warning', firstVec.loc, 'Interrupt vector changed without SEI before it.', 'An interrupt between the two writes jumps to half an address. Put "sei" before and "cli" after the change.');
    }
    if (seiList.length && !instrs.some(i => i.mn === 'CLI' || i.mn === 'RTI' || i.mn === 'PLP') && vec314.length) {
      add('warning', seiList[0].loc, 'SEI without a matching CLI.', 'Interrupts stay disabled - your raster IRQ will never run. Add "cli" after the setup.');
    }
    if (vecFFFE.length && !writesPort) add('warning', vecFFFE[0].loc, '$FFFE/$FFFF is written but the KERNAL ROM is still active.', 'With the KERNAL on, the CPU reads the vector from ROM. Use $0314/$0315, or switch the KERNAL off ("lda #$35 : sta $01").');
    const irqMask = writes(0xd01a);
    const ack = instrs.filter(i => i.value === 0xd019 && (i.mode === 'abs'));
    if (irqMask.length && !ack.length) add('warning', irqMask[0].loc, 'Raster interrupt enabled, but $D019 is never acknowledged.',
      'Write to $D019 in your interrupt (e.g. "lda #$ff : sta $d019" or "asl $d019"), otherwise the IRQ fires again immediately.');
    if (irqMask.length && vec314.length && !writes(0xdc0d).length) add('info', irqMask[0].loc, 'The CIA 1 timer interrupt is still active next to your raster IRQ.',
      'Both call the same vector. Usually you switch the timer IRQ off with "lda #$7f : sta $dc0d : lda $dc0d".');

    // ---------------------------------------------------------- decimal mode
    const sed = instrs.find(i => i.mn === 'SED');
    if (sed && !instrs.some(i => i.mn === 'CLD')) add('warning', sed.loc, 'SED (decimal mode) without CLD.', 'Decimal mode stays on and breaks every later ADC/SBC (also in interrupts). Add "cld" when done.');

    // ---------------------------------------------------------- stack balance
    let depth = 0, branches = false, start = null;
    for (const i of sorted) {
      if (targets.has(i.addr) && start === null) { start = i; depth = 0; branches = false; }
      if (['PHA', 'PHP'].includes(i.mn)) depth++;
      if (['PLA', 'PLP'].includes(i.mn)) depth--;
      if (i.mode === 'rel') branches = true;
      if (i.mn === 'RTS') {
        if (depth !== 0 && !branches && start) add('warning', i.loc, `Stack not balanced before RTS (${depth > 0 ? depth + ' more push(es)' : -depth + ' more pull(s)'}).`,
          'Every PHA/PHP needs a PLA/PLP before RTS, otherwise RTS returns to a wrong address.');
        start = null; depth = 0; branches = false;
      }
    }

    // ---------------------------------------------------------- SID includes
    for (const b of r.binaries || []) {
      if (b.sid && !b.explicitSize) {
        const s = b.sid;
        if (b.skip !== s.skip) add('error', b.loc, `Wrong skip value for the SID file: ${b.skip} (${h4(b.skip)}) - this tune needs ${h4(s.skip)}.`,
          `Use: !bin "${b.name}",, $${s.skip.toString(16)}   (PSID header $${s.dataOffset.toString(16)} bytes${s.skip > s.dataOffset ? ' + 2 bytes load address' : ''})`);
        else if (b.addr != null && b.addr !== s.loadAddress) add('error', b.loc,
          `The SID "${s.name || b.name}" must be loaded at ${h4(s.loadAddress)}, but here it is placed at ${h4(b.addr)}.`,
          `Change the address to "* = ${h4(s.loadAddress)}", or move the tune to ${h4(b.addr)} with Tools > Relocate SID.`);
        if (!instrs.some(i => i.mn === 'JSR' && i.value === s.initAddress)) add('info', b.loc, `The init routine of the tune (${h4(s.initAddress)}) is never called with JSR.`, `Call it once at start: "lda #0 : jsr ${h4(s.initAddress)}" (A = song number - 1).`);
        if (s.playAddress && !instrs.some(i => (i.mn === 'JSR' || i.mn === 'JMP') && i.value === s.playAddress)) add('info', b.loc, `The play routine (${h4(s.playAddress)}) is never called.`, 'Call it once per frame, best from a raster interrupt.');
        if (s.speed) add('info', b.loc, 'This tune uses CIA timing (speed flag set).', 'It may need to be called more often than once per frame (e.g. 2x or 4x). Check the tune\'s documentation.');
        if (s.type === 'RSID') add('info', b.loc, 'This is an RSID tune.', 'RSID tunes expect a real C64 environment and often install their own interrupts.');
      }
      if (b.kla && b.addr != null && b.skip !== 2 && b.size >= 10001) add('warning', b.loc, 'Koala files start with a 2-byte load address.', `Use: !bin "${b.name}",, 2`);
      // (only for the bitmap part: screen/colour data may be included elsewhere)
      if (b.kla && b.addr != null && (b.skip || 0) <= 2 && (b.addr & 0x1fff) !== 0) add('warning', b.loc, `Bitmap at ${h4(b.addr)} is not on an 8 KB boundary.`, 'The VIC-II can only show bitmaps at $0000 or $2000 inside its 16 KB bank (e.g. $2000, $6000, $a000, $e000).');
    }

    // ---------------------------------------------------------- VIC bank 0 char ROM shadow
    const d018 = findImmediateStores(sorted, 0xd018);
    const bankChanged = writes(0xdd00).length > 0;
    for (const s of d018) {
      const chr = ((s.value >> 1) & 7) * 0x800;
      if (!bankChanged && (chr === 0x1000 || chr === 0x1800) && s.value !== 0x14 && s.value !== 0x15 && s.value !== 0x16 && s.value !== 0x17) {
        add('info', s.loc, `$D018 = ${'$' + s.value.toString(16)} selects ${h4(chr)} as character set.`, 'In VIC bank 0 the VIC-II always sees the character ROM at $1000-$1FFF - a custom charset there stays invisible. Use $2000, $2800, $3000 or $3800.');
      }
    }

    // ---------------------------------------------------------- unused symbols
    const unused = (r.symbols || []).filter(s => s.isLabel && s.refs === 0 && s.loc && s.loc.file === mainPath && !/^(start|main|init|entry|basic|_)/i.test(s.name));
    if (unused.length && unused.length <= 25) {
      for (const s of unused) add('info', s.loc, `Label '${s.name}' is never used.`, 'Not a problem - just make sure it is not a typo.');
    } else if (unused.length) add('info', null, `${unused.length} labels are never used.`, '');
    return out;
  }

  function locOf(x) { return { file: x.file, line: x.line, col: 0, endCol: 1 }; }

  function labelAt(r, addr) {
    for (const s of r.symbolMap ? r.symbolMap.values() : []) if (s.isLabel && s.v === addr) return true;
    return false;
  }

  // looks for "$9e" (SYS token) followed by digits in the lines after "* = $0801"
  function findSys(lines, fromLine) {
    for (let l = fromLine; l < Math.min(lines.length, fromLine + 12); l++) {
      const line = lines[l].replace(/;.*$/, '');
      if (!/\$9e|158/i.test(line) && !/"\d{3,5}"/.test(line)) continue;
      let m = line.match(/"(\d{3,5})"/);
      if (!m) {
        for (let k = l; k < Math.min(lines.length, l + 3); k++) {
          const t = lines[k].replace(/;.*$/, '');
          m = t.match(/"(\d{3,5})"/);
          if (m) { l = k; break; }
          const bytes = t.match(/\$3[0-9](?:\s*,\s*\$3[0-9]){2,4}/i);
          if (bytes) { m = [null, bytes[0].split(',').map(b => String.fromCharCode(parseInt(b.trim().slice(1), 16))).join('')]; l = k; break; }
        }
      }
      if (m) return { line: l, addr: parseInt(m[1], 10) };
    }
    return null;
  }

  // "lda #x" directly followed by "sta ADDR"
  function findImmediateStores(sorted, addr) {
    const out = [];
    for (let k = 1; k < sorted.length; k++) {
      const p = sorted[k - 1], i = sorted[k];
      if (i.mn === 'STA' && i.value === addr && i.mode === 'abs' && p.mn === 'LDA' && p.mode === 'imm' && p.value != null) out.push({ value: p.value, loc: i.loc });
    }
    return out;
  }

  return { analyze };
});
