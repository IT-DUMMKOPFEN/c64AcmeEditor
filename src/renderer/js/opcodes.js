/*
 * C64 ACME EDITOR - 6502/6510 instruction set data
 * (c) IT-Dummköpfe - MIT License
 *
 * Data compiled from the public 6502 documentation (MOS programming manual,
 * C64-Wiki "Übersicht 6502-Assemblerbefehle", ACME "Illegals.txt").
 * Text descriptions are written for this editor.
 *
 * Mode keys:
 *   imp  implied            (no operand)
 *   acc  accumulator        (ACME: write the mnemonic without operand, e.g. "asl")
 *   imm  immediate          #$nn
 *   zp   zero page          $nn
 *   zpx  zero page,X        $nn,x
 *   zpy  zero page,Y        $nn,y
 *   abs  absolute           $nnnn
 *   abx  absolute,X         $nnnn,x
 *   aby  absolute,Y         $nnnn,y
 *   ind  indirect           ($nnnn)      (JMP only)
 *   izx  indexed indirect   ($nn,x)
 *   izy  indirect indexed   ($nn),y
 *   rel  relative           label        (branches)
 *
 * Each mode entry: [opcode, cycles, extra]  extra: '' | 'p' (+1 if page crossed)
 *                                                  | 'b' (+1 if taken, +2 if page crossed)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.C64Opcodes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MODES = {
    imp: { name: 'Implied', syntax: '', bytes: 1, example: '' },
    acc: { name: 'Accumulator', syntax: '', bytes: 1, example: '' },
    imm: { name: 'Immediate', syntax: '#$nn', bytes: 2, example: '#$0f' },
    zp:  { name: 'Zero page', syntax: '$nn', bytes: 2, example: '$fb' },
    zpx: { name: 'Zero page,X', syntax: '$nn,x', bytes: 2, example: '$fb,x' },
    zpy: { name: 'Zero page,Y', syntax: '$nn,y', bytes: 2, example: '$fb,y' },
    abs: { name: 'Absolute', syntax: '$nnnn', bytes: 3, example: '$d020' },
    abx: { name: 'Absolute,X', syntax: '$nnnn,x', bytes: 3, example: '$0400,x' },
    aby: { name: 'Absolute,Y', syntax: '$nnnn,y', bytes: 3, example: '$0400,y' },
    ind: { name: 'Indirect', syntax: '($nnnn)', bytes: 3, example: '($0314)' },
    izx: { name: 'Indexed indirect (X)', syntax: '($nn,x)', bytes: 2, example: '($fb,x)' },
    izy: { name: 'Indirect indexed (Y)', syntax: '($nn),y', bytes: 2, example: '($fb),y' },
    rel: { name: 'Relative', syntax: 'label', bytes: 2, example: 'loop' }
  };

  // Shared mode tables for the ALU group (ORA AND EOR ADC LDA CMP SBC)
  function alu(base) {
    return {
      izx: [base + 0x01, 6, ''], zp: [base + 0x05, 3, ''], imm: [base + 0x09, 2, ''],
      abs: [base + 0x0d, 4, ''], izy: [base + 0x11, 5, 'p'], zpx: [base + 0x15, 4, ''],
      aby: [base + 0x19, 4, 'p'], abx: [base + 0x1d, 4, 'p']
    };
  }
  function shift(base) { // ASL ROL LSR ROR
    return {
      zp: [base + 0x06, 5, ''], acc: [base + 0x0a, 2, ''], abs: [base + 0x0e, 6, ''],
      zpx: [base + 0x16, 6, ''], abx: [base + 0x1e, 7, '']
    };
  }
  function rmw(base) { // illegal read-modify-write combos SLO RLA SRE RRA DCP ISC
    return {
      izx: [base + 0x03, 8, ''], zp: [base + 0x07, 5, ''], abs: [base + 0x0f, 6, ''],
      izy: [base + 0x13, 8, ''], zpx: [base + 0x17, 6, ''], aby: [base + 0x1b, 7, ''],
      abx: [base + 0x1f, 7, '']
    };
  }
  const imp = (op, cyc) => ({ imp: [op, cyc, ''] });
  const rel = (op) => ({ rel: [op, 2, 'b'] });

  // ---------------------------------------------------------------- legal set
  const LEGAL = {
    ADC: { title: 'Add with Carry', group: 'Arithmetic', flags: 'NVZC', modes: alu(0x60),
      desc: 'Adds the operand and the carry flag to the accumulator. Clear the carry (CLC) before a fresh addition. In decimal mode (SED) the addition is done in BCD.',
      example: 'clc\nlda score\nadc #10\nsta score' },
    AND: { title: 'Logical AND', group: 'Logic', flags: 'NZ', modes: alu(0x20),
      desc: 'Bitwise AND between the accumulator and the operand. Typically used to clear (mask out) bits.',
      example: 'lda $d011\nand #%01111111  ; clear bit 7\nsta $d011' },
    ASL: { title: 'Arithmetic Shift Left', group: 'Shift', flags: 'NZC', modes: shift(0x00),
      desc: 'Shifts all bits one position to the left. Bit 7 goes into the carry, bit 0 becomes 0. Equivalent to multiplying by 2. Without operand it shifts the accumulator.',
      example: 'asl        ; A = A * 2\nasl $d019  ; acknowledge raster IRQ' },
    BCC: { title: 'Branch if Carry Clear', group: 'Branch', flags: '', modes: rel(0x90),
      desc: 'Branches if C = 0. After CMP this means "A is lower than the operand" (unsigned). Range: -128..+127 bytes.', example: 'cmp #10\nbcc lower' },
    BCS: { title: 'Branch if Carry Set', group: 'Branch', flags: '', modes: rel(0xb0),
      desc: 'Branches if C = 1. After CMP this means "A is greater than or equal to the operand" (unsigned).', example: 'cmp #10\nbcs greater_or_equal' },
    BEQ: { title: 'Branch if Equal', group: 'Branch', flags: '', modes: rel(0xf0),
      desc: 'Branches if Z = 1, i.e. the last result was zero or a comparison found equality.', example: 'lda text,x\nbeq done' },
    BIT: { title: 'Bit Test', group: 'Logic', flags: 'NVZ', modes: { zp: [0x24, 3, ''], abs: [0x2c, 4, ''] },
      desc: 'ANDs the accumulator with memory but only sets flags: Z from the result, N and V are copied from bit 7 and bit 6 of the memory value. A is not changed.',
      example: 'bit $d011\nbmi wait  ; raster line > 255?' },
    BMI: { title: 'Branch if Minus', group: 'Branch', flags: '', modes: rel(0x30),
      desc: 'Branches if N = 1 (bit 7 of the last result is set).', example: 'dex\nbmi done' },
    BNE: { title: 'Branch if Not Equal', group: 'Branch', flags: '', modes: rel(0xd0),
      desc: 'Branches if Z = 0, i.e. the last result was not zero. The classic loop instruction.', example: 'ldx #0\n- inx\nbne -' },
    BPL: { title: 'Branch if Plus', group: 'Branch', flags: '', modes: rel(0x10),
      desc: 'Branches if N = 0 (bit 7 of the last result is clear).', example: 'dex\nbpl loop' },
    BRK: { title: 'Break / Software Interrupt', group: 'System', flags: 'BI', modes: imp(0x00, 7),
      desc: 'Pushes PC+2 and the status register (with B flag set) and jumps through the IRQ/BRK vector at $FFFE. On the C64 this usually ends up in the monitor or BASIC warm start.',
      example: 'brk' },
    BVC: { title: 'Branch if Overflow Clear', group: 'Branch', flags: '', modes: rel(0x50),
      desc: 'Branches if V = 0. Also used as an "always" branch after CLV.', example: 'clv\nbvc always' },
    BVS: { title: 'Branch if Overflow Set', group: 'Branch', flags: '', modes: rel(0x70),
      desc: 'Branches if V = 1 (signed overflow, or bit 6 after BIT).', example: 'bit flag\nbvs set' },
    CLC: { title: 'Clear Carry', group: 'Flags', flags: 'C', modes: imp(0x18, 2), desc: 'Sets C = 0. Use before ADC.', example: 'clc\nadc #1' },
    CLD: { title: 'Clear Decimal', group: 'Flags', flags: 'D', modes: imp(0xd8, 2), desc: 'Switches back to binary arithmetic (D = 0).', example: 'cld' },
    CLI: { title: 'Clear Interrupt Disable', group: 'Flags', flags: 'I', modes: imp(0x58, 2), desc: 'Enables IRQ interrupts (I = 0). Pair it with SEI around interrupt setup code.', example: 'cli' },
    CLV: { title: 'Clear Overflow', group: 'Flags', flags: 'V', modes: imp(0xb8, 2), desc: 'Sets V = 0.', example: 'clv' },
    CMP: { title: 'Compare Accumulator', group: 'Compare', flags: 'NZC', modes: alu(0xc0),
      desc: 'Subtracts the operand from A without storing the result. Z=1 if equal, C=1 if A >= operand (unsigned), N from bit 7 of the difference.',
      example: 'lda $d012\ncmp #$80\nbne wait' },
    CPX: { title: 'Compare X Register', group: 'Compare', flags: 'NZC', modes: { imm: [0xe0, 2, ''], zp: [0xe4, 3, ''], abs: [0xec, 4, ''] },
      desc: 'Like CMP but compares the X register.', example: 'inx\ncpx #40\nbne loop' },
    CPY: { title: 'Compare Y Register', group: 'Compare', flags: 'NZC', modes: { imm: [0xc0, 2, ''], zp: [0xc4, 3, ''], abs: [0xcc, 4, ''] },
      desc: 'Like CMP but compares the Y register.', example: 'iny\ncpy #8\nbne loop' },
    DEC: { title: 'Decrement Memory', group: 'Inc/Dec', flags: 'NZ', modes: { zp: [0xc6, 5, ''], zpx: [0xd6, 6, ''], abs: [0xce, 6, ''], abx: [0xde, 7, ''] },
      desc: 'Subtracts 1 from a memory location. (The NMOS 6502 has no DEC A - use SEC/SBC #1 or CLC/ADC #$FF.)', example: 'dec $d020' },
    DEX: { title: 'Decrement X', group: 'Inc/Dec', flags: 'NZ', modes: imp(0xca, 2), desc: 'X = X - 1.', example: 'dex\nbne loop' },
    DEY: { title: 'Decrement Y', group: 'Inc/Dec', flags: 'NZ', modes: imp(0x88, 2), desc: 'Y = Y - 1.', example: 'dey\nbpl loop' },
    EOR: { title: 'Exclusive OR', group: 'Logic', flags: 'NZ', modes: alu(0x40),
      desc: 'Bitwise exclusive OR between A and the operand. EOR #$FF inverts all bits.', example: 'lda $d018\neor #%00000010\nsta $d018' },
    INC: { title: 'Increment Memory', group: 'Inc/Dec', flags: 'NZ', modes: { zp: [0xe6, 5, ''], zpx: [0xf6, 6, ''], abs: [0xee, 6, ''], abx: [0xfe, 7, ''] },
      desc: 'Adds 1 to a memory location. Wraps from $FF to $00.', example: 'inc $d020' },
    INX: { title: 'Increment X', group: 'Inc/Dec', flags: 'NZ', modes: imp(0xe8, 2), desc: 'X = X + 1.', example: 'inx' },
    INY: { title: 'Increment Y', group: 'Inc/Dec', flags: 'NZ', modes: imp(0xc8, 2), desc: 'Y = Y + 1.', example: 'iny' },
    JMP: { title: 'Jump', group: 'Jump', flags: '', modes: { abs: [0x4c, 3, ''], ind: [0x6c, 5, ''] },
      desc: 'Continues execution at the given address. The indirect form reads the target from a pointer. NMOS bug: JMP ($xxFF) fetches the high byte from $xx00 instead of $xx+1,00.',
      example: 'jmp main\njmp ($0314)' },
    JSR: { title: 'Jump to Subroutine', group: 'Jump', flags: '', modes: { abs: [0x20, 6, ''] },
      desc: 'Pushes the return address (minus one) onto the stack and jumps to a subroutine. Return with RTS.', example: 'jsr $ffd2   ; CHROUT' },
    LDA: { title: 'Load Accumulator', group: 'Load/Store', flags: 'NZ', modes: (function () { const m = alu(0xa0); return m; })(),
      desc: 'Loads a value into the accumulator.', example: 'lda #$00\nlda $d012\nlda table,x' },
    LDX: { title: 'Load X Register', group: 'Load/Store', flags: 'NZ', modes: { imm: [0xa2, 2, ''], zp: [0xa6, 3, ''], zpy: [0xb6, 4, ''], abs: [0xae, 4, ''], aby: [0xbe, 4, 'p'] },
      desc: 'Loads a value into X. Note: indexed modes use Y.', example: 'ldx #0' },
    LDY: { title: 'Load Y Register', group: 'Load/Store', flags: 'NZ', modes: { imm: [0xa0, 2, ''], zp: [0xa4, 3, ''], zpx: [0xb4, 4, ''], abs: [0xac, 4, ''], abx: [0xbc, 4, 'p'] },
      desc: 'Loads a value into Y. Note: indexed modes use X.', example: 'ldy #39' },
    LSR: { title: 'Logical Shift Right', group: 'Shift', flags: 'NZC', modes: shift(0x40),
      desc: 'Shifts all bits one position to the right. Bit 0 goes into the carry, bit 7 becomes 0. Divides by 2.', example: 'lsr\nlsr\nlsr\nlsr   ; A = A / 16' },
    NOP: { title: 'No Operation', group: 'System', flags: '', modes: imp(0xea, 2), desc: 'Does nothing for 2 cycles. Useful for timing.', example: 'nop' },
    ORA: { title: 'Logical OR', group: 'Logic', flags: 'NZ', modes: alu(0x00),
      desc: 'Bitwise OR between A and the operand. Used to set bits.', example: 'lda $d011\nora #%00100000  ; bitmap mode\nsta $d011' },
    PHA: { title: 'Push Accumulator', group: 'Stack', flags: '', modes: imp(0x48, 3), desc: 'Pushes A onto the stack ($0100-$01FF).', example: 'pha' },
    PHP: { title: 'Push Processor Status', group: 'Stack', flags: '', modes: imp(0x08, 3), desc: 'Pushes the status register (with B and bit 5 set) onto the stack.', example: 'php' },
    PLA: { title: 'Pull Accumulator', group: 'Stack', flags: 'NZ', modes: imp(0x68, 4), desc: 'Pulls a byte from the stack into A.', example: 'pla' },
    PLP: { title: 'Pull Processor Status', group: 'Stack', flags: 'NVDIZC', modes: imp(0x28, 4), desc: 'Pulls the status register from the stack.', example: 'plp' },
    ROL: { title: 'Rotate Left', group: 'Shift', flags: 'NZC', modes: shift(0x20),
      desc: 'Rotates bits left through the carry: old carry goes into bit 0, bit 7 into the carry. Used for multi-byte shifts.', example: 'asl lo\nrol hi   ; 16-bit * 2' },
    ROR: { title: 'Rotate Right', group: 'Shift', flags: 'NZC', modes: shift(0x60),
      desc: 'Rotates bits right through the carry: old carry goes into bit 7, bit 0 into the carry.', example: 'lsr hi\nror lo   ; 16-bit / 2' },
    RTI: { title: 'Return from Interrupt', group: 'Jump', flags: 'NVDIZC', modes: imp(0x40, 6),
      desc: 'Pulls the status register and the program counter from the stack. Ends an interrupt handler (when not chaining to the KERNAL with JMP $EA31 / $EA81).', example: 'pla\ntay\npla\ntax\npla\nrti' },
    RTS: { title: 'Return from Subroutine', group: 'Jump', flags: '', modes: imp(0x60, 6), desc: 'Pulls the return address from the stack and continues after the JSR.', example: 'rts' },
    SBC: { title: 'Subtract with Carry', group: 'Arithmetic', flags: 'NVZC', modes: alu(0xe0),
      desc: 'A = A - operand - (1 - C). Set the carry (SEC) before a fresh subtraction. C=0 afterwards means a borrow happened.', example: 'sec\nlda lives\nsbc #1\nsta lives' },
    SEC: { title: 'Set Carry', group: 'Flags', flags: 'C', modes: imp(0x38, 2), desc: 'Sets C = 1. Use before SBC.', example: 'sec' },
    SED: { title: 'Set Decimal', group: 'Flags', flags: 'D', modes: imp(0xf8, 2), desc: 'Enables BCD arithmetic for ADC/SBC. Remember CLD afterwards - the KERNAL IRQ does not clear it.', example: 'sed\nclc\nadc #1\ncld' },
    SEI: { title: 'Set Interrupt Disable', group: 'Flags', flags: 'I', modes: imp(0x78, 2), desc: 'Disables IRQ interrupts (NMIs still happen). Use before changing interrupt vectors.', example: 'sei' },
    STA: { title: 'Store Accumulator', group: 'Load/Store', flags: '',
      modes: { izx: [0x81, 6, ''], zp: [0x85, 3, ''], abs: [0x8d, 4, ''], izy: [0x91, 6, ''], zpx: [0x95, 4, ''], aby: [0x99, 5, ''], abx: [0x9d, 5, ''] },
      desc: 'Stores A into memory. There is no immediate mode - you cannot store into a constant.', example: 'lda #0\nsta $d020' },
    STX: { title: 'Store X Register', group: 'Load/Store', flags: '', modes: { zp: [0x86, 3, ''], zpy: [0x96, 4, ''], abs: [0x8e, 4, ''] },
      desc: 'Stores X into memory. Only zp, zp,Y and absolute modes exist.', example: 'stx $d021' },
    STY: { title: 'Store Y Register', group: 'Load/Store', flags: '', modes: { zp: [0x84, 3, ''], zpx: [0x94, 4, ''], abs: [0x8c, 4, ''] },
      desc: 'Stores Y into memory. Only zp, zp,X and absolute modes exist.', example: 'sty $fb' },
    TAX: { title: 'Transfer A to X', group: 'Transfer', flags: 'NZ', modes: imp(0xaa, 2), desc: 'X = A.', example: 'tax' },
    TAY: { title: 'Transfer A to Y', group: 'Transfer', flags: 'NZ', modes: imp(0xa8, 2), desc: 'Y = A.', example: 'tay' },
    TSX: { title: 'Transfer Stack Pointer to X', group: 'Transfer', flags: 'NZ', modes: imp(0xba, 2), desc: 'X = stack pointer.', example: 'tsx' },
    TXA: { title: 'Transfer X to A', group: 'Transfer', flags: 'NZ', modes: imp(0x8a, 2), desc: 'A = X.', example: 'txa' },
    TXS: { title: 'Transfer X to Stack Pointer', group: 'Transfer', flags: '', modes: imp(0x9a, 2), desc: 'Stack pointer = X. Flags are not changed.', example: 'ldx #$ff\ntxs' },
    TYA: { title: 'Transfer Y to A', group: 'Transfer', flags: 'NZ', modes: imp(0x98, 2), desc: 'A = Y.', example: 'tya' }
  };

  // ------------------------------------------------------- illegal (6510) set
  // Names follow ACME (enable with "!cpu 6510").
  const ILLEGAL = {
    SLO: { title: 'ASL + ORA', aka: 'ASO', flags: 'NZC', modes: rmw(0x00), desc: 'Shifts memory left, then ORs the result into A.' },
    RLA: { title: 'ROL + AND', aka: '', flags: 'NZC', modes: rmw(0x20), desc: 'Rotates memory left, then ANDs the result into A.' },
    SRE: { title: 'LSR + EOR', aka: 'LSE', flags: 'NZC', modes: rmw(0x40), desc: 'Shifts memory right, then EORs the result into A.' },
    RRA: { title: 'ROR + ADC', aka: '', flags: 'NVZC', modes: rmw(0x60), desc: 'Rotates memory right, then adds the result to A with carry.' },
    SAX: { title: 'Store A AND X', aka: 'AXS, AAX', flags: '', modes: { izx: [0x83, 6, ''], zp: [0x87, 3, ''], abs: [0x8f, 4, ''], zpy: [0x97, 4, ''] }, desc: 'Stores A AND X into memory (flags unaffected).' },
    LAX: { title: 'LDA + LDX', aka: '', flags: 'NZ', modes: { izx: [0xa3, 6, ''], zp: [0xa7, 3, ''], abs: [0xaf, 4, ''], izy: [0xb3, 5, 'p'], zpy: [0xb7, 4, ''], aby: [0xbf, 4, 'p'] }, desc: 'Loads the same value into A and X.' },
    DCP: { title: 'DEC + CMP', aka: 'DCM', flags: 'NZC', modes: rmw(0xc0), desc: 'Decrements memory, then compares it with A.' },
    ISC: { title: 'INC + SBC', aka: 'ISB, INS', flags: 'NVZC', modes: rmw(0xe0), desc: 'Increments memory, then subtracts it from A with borrow.' },
    LAS: { title: 'Load A, X, S', aka: 'LAR, LAE', flags: 'NZ', modes: { aby: [0xbb, 4, 'p'] }, desc: 'A = X = S = memory AND S.' },
    TAS: { title: 'Transfer A AND X to S', aka: 'SHS, XAS', flags: '', modes: { aby: [0x9b, 5, ''] }, desc: 'Unstable. S = A AND X, then stores S AND (high byte+1).' },
    SHA: { title: 'Store A AND X AND H', aka: 'AXA, AHX', flags: '', modes: { aby: [0x9f, 5, ''], izy: [0x93, 6, ''] }, desc: 'Unstable. Stores A AND X AND (high byte of address + 1).' },
    SHX: { title: 'Store X AND H', aka: 'SXA, XAS', flags: '', modes: { aby: [0x9e, 5, ''] }, desc: 'Unstable. Stores X AND (high byte of address + 1).' },
    SHY: { title: 'Store Y AND H', aka: 'SYA, SAY', flags: '', modes: { abx: [0x9c, 5, ''] }, desc: 'Unstable. Stores Y AND (high byte of address + 1).' },
    ANC: { title: 'AND + set C from bit 7', aka: '', flags: 'NZC', modes: { imm: [0x0b, 2, ''] }, desc: 'ANDs A with the operand and copies bit 7 into the carry.' },
    ASR: { title: 'AND + LSR', aka: 'ALR', flags: 'NZC', modes: { imm: [0x4b, 2, ''] }, desc: 'ANDs A with the operand, then shifts A right.' },
    ARR: { title: 'AND + ROR', aka: '', flags: 'NVZC', modes: { imm: [0x6b, 2, ''] }, desc: 'ANDs A with the operand, then rotates A right (special flag behaviour).' },
    SBX: { title: '(A AND X) - operand -> X', aka: 'AXS', flags: 'NZC', modes: { imm: [0xcb, 2, ''] }, desc: 'X = (A AND X) - operand, without borrow. Handy for fast X adjustments.' },
    DOP: { title: 'Double NOP', aka: 'NOP, SKB', flags: '', modes: { imp: [0x80, 2, ''], imm: [0x80, 2, ''], zp: [0x04, 3, ''], zpx: [0x14, 4, ''] }, desc: 'A NOP that skips one operand byte.' },
    TOP: { title: 'Triple NOP', aka: 'NOP, SKW', flags: '', modes: { imp: [0x0c, 4, ''], abs: [0x0c, 4, ''], abx: [0x1c, 4, 'p'] }, desc: 'A NOP that skips two operand bytes.' },
    JAM: { title: 'Halt the CPU', aka: 'KIL, HLT', flags: '', modes: { imp: [0x02, 0, ''] }, desc: 'Locks up the CPU until reset.' },
    ANE: { title: 'Unstable A = (A|?) & X & op', aka: 'XAA', flags: 'NZ', modes: { imm: [0x8b, 2, ''] }, desc: 'Highly unstable. Only ANE #0 is reliable.' },
    LXA: { title: 'Unstable A = X = (A|?) & op', aka: 'LAX #', flags: 'NZ', modes: { imm: [0xab, 2, ''] }, desc: 'Unstable. LXA #0 reliably clears A and X.' }
  };
  Object.keys(ILLEGAL).forEach(k => { ILLEGAL[k].group = 'Illegal'; ILLEGAL[k].illegal = true; });

  const ALL = Object.assign({}, LEGAL, ILLEGAL);

  // size of an instruction in a given mode
  function sizeOf(mode) { return MODES[mode] ? MODES[mode].bytes : 1; }

  // Build opcode -> {mnemonic, mode} table (for disassembly / help tables)
  const BY_OPCODE = new Array(256).fill(null);
  Object.keys(ALL).forEach(mn => {
    const modes = ALL[mn].modes;
    Object.keys(modes).forEach(m => {
      const op = modes[m][0];
      if (mn === 'DOP' && m === 'imp') return;
      if (mn === 'TOP' && m === 'imp') return;
      if (!BY_OPCODE[op]) BY_OPCODE[op] = { mnemonic: mn, mode: m, cycles: modes[m][1], extra: modes[m][2], illegal: !!ALL[mn].illegal };
    });
  });

  // ---------------------------------------------------------- ACME pseudo ops
  // name -> {args, desc, aliasOf}
  const PSEUDO = {
    '!8': { aliasOf: '!byte' }, '!08': { aliasOf: '!byte' }, '!by': { aliasOf: '!byte' },
    '!byte': { args: 'EXPR [, EXPR]*', desc: 'Insert 8-bit values (-128..255).', example: '!byte $01, 2, %00000011' },
    '!16': { aliasOf: '!word' }, '!wo': { aliasOf: '!word' },
    '!word': { args: 'EXPR [, EXPR]*', desc: 'Insert 16-bit values in little-endian order (low byte first).', example: '!word irq_handler, $0801' },
    '!le16': { args: 'EXPR [, EXPR]*', desc: 'Insert 16-bit little-endian values.' },
    '!be16': { args: 'EXPR [, EXPR]*', desc: 'Insert 16-bit big-endian values.' },
    '!24': { args: 'EXPR [, EXPR]*', desc: 'Insert 24-bit values.' },
    '!le24': { args: 'EXPR [, EXPR]*', desc: 'Insert 24-bit little-endian values.' },
    '!be24': { args: 'EXPR [, EXPR]*', desc: 'Insert 24-bit big-endian values.' },
    '!32': { args: 'EXPR [, EXPR]*', desc: 'Insert 32-bit values.' },
    '!le32': { args: 'EXPR [, EXPR]*', desc: 'Insert 32-bit little-endian values.' },
    '!be32': { args: 'EXPR [, EXPR]*', desc: 'Insert 32-bit big-endian values.' },
    '!h': { aliasOf: '!hex' },
    '!hex': { args: 'HEXPAIRS', desc: 'Insert bytes given as plain pairs of hex digits.', example: '!hex 0102 a9ff' },
    '!fi': { aliasOf: '!fill' },
    '!fill': { args: 'AMOUNT [, VALUE]', desc: 'Fill AMOUNT bytes with VALUE (default 0).', example: '!fill 64, $00' },
    '!skip': { args: 'AMOUNT', desc: 'Advance the program counter without writing bytes (no new segment).', example: '!skip 256' },
    '!align': { args: 'ANDVALUE, EQUALVALUE [, FILL]', desc: 'Fill until (PC AND ANDVALUE) = EQUALVALUE. "!align 255, 0" aligns to the next page.', example: '!align 255, 0' },
    '!ct': { aliasOf: '!convtab' },
    '!convtab': { args: 'raw|pet|scr|"file" [{ BLOCK }]', desc: 'Choose the text conversion table for !text and character literals.', example: '!ct scr' },
    '!tx': { aliasOf: '!text' },
    '!text': { args: 'STRING [, STRING]*', desc: 'Output strings using the current conversion table.', example: '!text "hello", 0' },
    '!pet': { args: 'STRING [, STRING]*', desc: 'Output strings converted to PETSCII (for KERNAL CHROUT / $FFD2).', example: '!pet "hello world", 13, 0' },
    '!raw': { args: 'STRING [, STRING]*', desc: 'Output strings without any conversion.', example: '!raw "abc"' },
    '!scr': { args: 'STRING [, STRING]*', desc: 'Output strings converted to C64 screen codes (for writing directly to $0400).', example: '!scr "hello world"' },
    '!scrxor': { args: 'XOR, STRING [, STRING]*', desc: 'Like !scr, but every byte is XORed (e.g. $80 for reverse characters).', example: '!scrxor $80, "reverse"' },
    '!to': { args: '"FILE", cbm|plain|apple', desc: 'Set the output file name and format. "cbm" writes a 2-byte load address (a .prg file).', example: '!to "demo.prg", cbm' },
    '!src': { aliasOf: '!source' },
    '!source': { args: '"FILE"', desc: 'Assemble another source file at this position.', example: '!source "macros.a"' },
    '!bin': { aliasOf: '!binary' },
    '!binary': { args: '"FILE" [, [SIZE] [, [SKIP]]]', desc: 'Include a binary file. SKIP bytes are skipped at the start (e.g. $7e for a PSID header + load address, 2 for a .prg/.kla load address).', example: '!bin "music.sid",, $7e' },
    '!zn': { aliasOf: '!zone' },
    '!zone': { args: '[TITLE] [{ BLOCK }]', desc: 'Start a new zone for local ".symbols".', example: '!zone print_routine' },
    '!sl': { aliasOf: '!symbollist' },
    '!symbollist': { args: '"FILE"', desc: 'Write all global symbols to a file after assembly.', example: '!sl "labels.txt"' },
    '!if': { args: 'CONDITION { BLOCK } [else { BLOCK }]', desc: 'Conditional assembly.', example: '!if DEBUG = 1 {\n\tinc $d020\n}' },
    '!ifdef': { args: 'SYMBOL { BLOCK } [else { BLOCK }]', desc: 'Assemble block if SYMBOL is defined.' },
    '!ifndef': { args: 'SYMBOL { BLOCK } [else { BLOCK }]', desc: 'Assemble block if SYMBOL is not defined.' },
    '!for': { args: 'SYMBOL, START, END { BLOCK }', desc: 'Repeat a block while SYMBOL counts from START to END (inclusive).', example: '!for i, 0, 255 {\n\t!byte 128 + 127 * sin(float(i) / 128 * 3.14159265)\n}' },
    '!set': { args: 'SYMBOL = VALUE', desc: 'Assign a value to a symbol, even if it already has one.', example: '!set counter = counter + 1' },
    '!do': { args: '[while|until COND] { BLOCK } [while|until COND]', desc: 'Loop a block while/until a condition holds.' },
    '!while': { args: 'CONDITION { BLOCK }', desc: 'Loop a block while the condition is true (ACME 0.97+).' },
    '!eof': { aliasOf: '!endoffile' },
    '!endoffile': { args: '', desc: 'Stop processing the current source file.' },
    '!warn': { args: 'STRING [, ...]', desc: 'Output a warning during assembly.' },
    '!error': { args: 'STRING [, ...]', desc: 'Output an error (no output file will be written).' },
    '!serious': { args: 'STRING [, ...]', desc: 'Output a serious error and stop assembling.' },
    '!macro': { args: 'NAME [[~]SYMBOL [, [~]SYMBOL]*] { BLOCK }', desc: 'Define a macro. Call it with +NAME arguments.', example: '!macro set_border .color {\n\tlda #.color\n\tsta $d020\n}\n\t+set_border 2' },
    '!initmem': { args: 'VALUE', desc: 'Byte value used for gaps between segments.' },
    '!xor': { args: 'VALUE [{ BLOCK }]', desc: 'XOR all output bytes with VALUE.' },
    '!pseudopc': { args: 'ADDRESS { BLOCK }', desc: 'Assemble a block as if it ran at ADDRESS (code that is copied elsewhere before running).', example: '!pseudopc $c000 {\n\t; code copied to $c000\n}' },
    '!cpu': { args: '6502|6510|65c02|r65c02|w65c02|65816|65ce02|4502|m65|c64dtv2 [{ BLOCK }]', desc: 'Select the processor. Use "!cpu 6510" to allow illegal opcodes.', example: '!cpu 6510' },
    '!al': { args: '[{ BLOCK }]', desc: '65816: assume long accumulator.' },
    '!as': { args: '[{ BLOCK }]', desc: '65816: assume short accumulator.' },
    '!rl': { args: '[{ BLOCK }]', desc: '65816: assume long index registers.' },
    '!rs': { args: '[{ BLOCK }]', desc: '65816: assume short index registers.' },
    '!addr': { aliasOf: '!address' },
    '!address': { args: '[SYMBOL = VALUE] | { BLOCK }', desc: 'Mark symbols as addresses for the optional type checker.' },
    '!cbm': { args: '', desc: 'Obsolete. Use "!ct pet".', obsolete: true },
    '!subzone': { args: '', desc: 'Obsolete. Use "!zone {}".', obsolete: true },
    '!sz': { aliasOf: '!subzone' },
    '!realpc': { args: '', desc: 'Obsolete. Use "!pseudopc ADDR { }".', obsolete: true }
  };

  function canonicalPseudo(name) {
    const n = name.toLowerCase();
    const p = PSEUDO[n];
    if (!p) return null;
    return p.aliasOf || n;
  }

  return {
    MODES, LEGAL, ILLEGAL, ALL, BY_OPCODE, PSEUDO,
    sizeOf, canonicalPseudo,
    isMnemonic(name, allowIllegal) {
      const n = name.toUpperCase();
      return !!(LEGAL[n] || (allowIllegal && ILLEGAL[n]));
    },
    isAnyMnemonic(name) { return !!ALL[name.toUpperCase()]; },
    get(name) { return ALL[name.toUpperCase()] || null; },
    mnemonicList() { return Object.keys(LEGAL); },
    illegalList() { return Object.keys(ILLEGAL); },
    pseudoList() { return Object.keys(PSEUDO); }
  };
});
