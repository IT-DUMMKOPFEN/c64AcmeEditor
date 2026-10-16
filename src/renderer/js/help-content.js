/*
 * C64 ACME EDITOR - help pages
 * (c) IT-Dummköpfe - MIT License
 *
 * All texts are written for this editor. Facts were checked against the
 * sources listed on the page "Sources & further reading".
 * Pages with "gen" are generated in help.js from the data in opcodes.js.
 */
(function () {
  'use strict';

  const p = (id, title, html, extra) => Object.assign({ id, title, html }, extra || {});

  // ---------------------------------------------------------------- tables
  const KERNAL = [
    ['$FF81', 'CINT', 'Initialise the screen editor and the VIC-II.', '-'],
    ['$FF84', 'IOINIT', 'Initialise the CIAs, SID volume and the I/O port.', '-'],
    ['$FF87', 'RAMTAS', 'Clear zero page, find RAM top, set the tape buffer and screen.', '-'],
    ['$FF8A', 'RESTOR', 'Restore the default system vectors ($0314-$0333).', '-'],
    ['$FF8D', 'VECTOR', 'Read (C=1) or set (C=0) the system vectors from/to a table at X/Y.', 'X/Y = table'],
    ['$FF90', 'SETMSG', 'Turn KERNAL messages on/off (bit 7 = control, bit 6 = error).', 'A = flags'],
    ['$FF93', 'SECOND', 'Send a secondary address after LISTEN.', 'A'],
    ['$FF96', 'TKSA', 'Send a secondary address after TALK.', 'A'],
    ['$FF99', 'MEMTOP', 'Read (C=1) / set (C=0) the top of BASIC memory.', 'X/Y'],
    ['$FF9C', 'MEMBOT', 'Read (C=1) / set (C=0) the bottom of memory.', 'X/Y'],
    ['$FF9F', 'SCNKEY', 'Scan the keyboard (normally done by the IRQ).', '-'],
    ['$FFA2', 'SETTMO', 'Set the IEEE timeout flag.', 'A'],
    ['$FFA5', 'ACPTR', 'Read a byte from the serial bus.', 'returns A'],
    ['$FFA8', 'CIOUT', 'Write a byte to the serial bus.', 'A'],
    ['$FFAB', 'UNTLK', 'Send UNTALK.', '-'],
    ['$FFAE', 'UNLSN', 'Send UNLISTEN.', '-'],
    ['$FFB1', 'LISTEN', 'Command a device to listen.', 'A = device'],
    ['$FFB4', 'TALK', 'Command a device to talk.', 'A = device'],
    ['$FFB7', 'READST', 'Read the I/O status byte (ST).', 'returns A'],
    ['$FFBA', 'SETLFS', 'Set logical file number, device and secondary address.', 'A, X, Y'],
    ['$FFBD', 'SETNAM', 'Set the file name.', 'A = length, X/Y = address'],
    ['$FFC0', 'OPEN', 'Open a logical file (after SETLFS + SETNAM).', '-'],
    ['$FFC3', 'CLOSE', 'Close a logical file.', 'A = file'],
    ['$FFC6', 'CHKIN', 'Use a file as input channel.', 'X = file'],
    ['$FFC9', 'CHKOUT', 'Use a file as output channel.', 'X = file'],
    ['$FFCC', 'CLRCHN', 'Reset input/output to keyboard/screen.', '-'],
    ['$FFCF', 'CHRIN', 'Read a character from the input channel (keyboard: a whole line).', 'returns A'],
    ['$FFD2', 'CHROUT', 'Print a character (PETSCII) to the output channel. Keeps X and Y.', 'A'],
    ['$FFD5', 'LOAD', 'Load (A=0) or verify (A=1) a file. Returns end address in X/Y.', 'A, X/Y'],
    ['$FFD8', 'SAVE', 'Save memory: A = zero page pointer to the start, X/Y = end + 1.', 'A, X/Y'],
    ['$FFDB', 'SETTIM', 'Set the jiffy clock.', 'A, X, Y'],
    ['$FFDE', 'RDTIM', 'Read the jiffy clock (1/60 s).', 'returns A, X, Y'],
    ['$FFE1', 'STOP', 'Check the RUN/STOP key (Z=1 if pressed).', '-'],
    ['$FFE4', 'GETIN', 'Get a key from the keyboard buffer (A=0: no key).', 'returns A'],
    ['$FFE7', 'CLALL', 'Close all files.', '-'],
    ['$FFEA', 'UDTIM', 'Advance the jiffy clock (called by the IRQ).', '-'],
    ['$FFED', 'SCREEN', 'Return the screen size: X = 40 columns, Y = 25 rows.', 'returns X, Y'],
    ['$FFF0', 'PLOT', 'Read (C=1) or set (C=0) the cursor: X = row, Y = column.', 'X, Y'],
    ['$FFF3', 'IOBASE', 'Return the I/O base address ($DC00) in X/Y.', 'returns X/Y']
  ];

  const VIC = [
    ['$D000-$D00F', 'Sprite 0-7 X / Y', 'Pairs: $D000 = X of sprite 0, $D001 = Y of sprite 0, $D002 = X of sprite 1 ...'],
    ['$D010', 'Sprite X bit 8', 'Bit n = bit 8 of the X position of sprite n (needed for X > 255).'],
    ['$D011', 'Control register 1', 'Bit 7: raster line bit 8 (read) / IRQ line bit 8 (write). Bit 6: extended colour mode. Bit 5: bitmap mode. Bit 4: screen on. Bit 3: 25 rows (0 = 24). Bits 0-2: vertical fine scroll. Default $1B.'],
    ['$D012', 'Raster line', 'Read: current raster line (bits 0-7). Write: line for the raster interrupt.'],
    ['$D013 / $D014', 'Light pen X / Y', 'Latched light pen position.'],
    ['$D015', 'Sprite enable', 'Bit n = 1: sprite n is visible.'],
    ['$D016', 'Control register 2', 'Bit 4: multicolour mode. Bit 3: 40 columns (0 = 38). Bits 0-2: horizontal fine scroll. Default $C8.'],
    ['$D017', 'Sprite double height', 'Bit n = 1: sprite n is stretched vertically.'],
    ['$D018', 'Memory pointers', 'Bits 4-7: screen RAM = value * $400. Bits 1-3: character set = value * $800. In bitmap mode bit 3 selects the bitmap ($0000 / $2000). All relative to the VIC bank. Default $15 (screen $0400, ROM charset upper case) or $17 (lower case).'],
    ['$D019', 'Interrupt flags', 'Bit 0: raster, bit 1: sprite-background collision, bit 2: sprite-sprite collision, bit 3: light pen, bit 7: any. Write 1 bits to acknowledge.'],
    ['$D01A', 'Interrupt enable', 'Same bits as $D019. Bit 0 = 1 enables the raster interrupt.'],
    ['$D01B', 'Sprite priority', 'Bit n = 1: sprite n is drawn behind the foreground graphics.'],
    ['$D01C', 'Sprite multicolour', 'Bit n = 1: sprite n is a multicolour sprite (12 x 21 double-wide pixels).'],
    ['$D01D', 'Sprite double width', 'Bit n = 1: sprite n is stretched horizontally.'],
    ['$D01E', 'Sprite-sprite collision', 'Bits of all sprites that touched another sprite. Cleared when read.'],
    ['$D01F', 'Sprite-background collision', 'Bits of all sprites that touched foreground graphics. Cleared when read.'],
    ['$D020', 'Border colour', 'Colour 0-15.'],
    ['$D021', 'Background colour 0', 'Colour 0-15.'],
    ['$D022 / $D023 / $D024', 'Background colours 1-3', 'Used in multicolour and extended colour modes.'],
    ['$D025 / $D026', 'Sprite multicolours 0 / 1', 'Shared by all multicolour sprites (bit pairs %01 and %11).'],
    ['$D027-$D02E', 'Sprite 0-7 colour', 'Individual colour of each sprite (bit pair %10 in multicolour).']
  ];

  const SID = [
    ['$D400 / $D401', 'Voice 1 frequency lo / hi', '16-bit value. Frequency in Hz = value * 0.0587 (PAL).'],
    ['$D402 / $D403', 'Voice 1 pulse width', '12 bits ($D403 bits 0-3). $0800 = square wave.'],
    ['$D404', 'Voice 1 control', 'Bit 0: gate (1 = attack/decay/sustain, 0 = release). Bit 1: sync. Bit 2: ring modulation. Bit 3: test. Bit 4: triangle. Bit 5: sawtooth. Bit 6: pulse. Bit 7: noise.'],
    ['$D405', 'Voice 1 attack / decay', 'Bits 4-7 attack, bits 0-3 decay.'],
    ['$D406', 'Voice 1 sustain / release', 'Bits 4-7 sustain level, bits 0-3 release.'],
    ['$D407-$D40D', 'Voice 2', 'Same layout as voice 1.'],
    ['$D40E-$D414', 'Voice 3', 'Same layout as voice 1.'],
    ['$D415 / $D416', 'Filter cutoff', '11 bits: $D415 bits 0-2 = low bits, $D416 = high 8 bits.'],
    ['$D417', 'Resonance / routing', 'Bits 4-7 resonance. Bit 0-2: voices 1-3 through the filter. Bit 3: external input.'],
    ['$D418', 'Mode / volume', 'Bits 0-3 volume. Bit 4 low pass, bit 5 band pass, bit 6 high pass, bit 7 voice 3 off.'],
    ['$D419 / $D41A', 'Paddle X / Y', 'Read only.'],
    ['$D41B', 'Oscillator 3', 'Read only: upper 8 bits of voice 3\'s waveform. With noise = random numbers.'],
    ['$D41C', 'Envelope 3', 'Read only: current envelope level of voice 3.']
  ];

  const CIA = [
    ['$DC00', 'CIA 1 port A', 'Keyboard columns (write, 0 = selected). Joystick port 2 (read): bit 0 up, 1 down, 2 left, 3 right, 4 fire - 0 = active.'],
    ['$DC01', 'CIA 1 port B', 'Keyboard rows (read, 0 = key down). Joystick port 1 (same bits).'],
    ['$DC02 / $DC03', 'CIA 1 data direction A / B', '1 = output. Default $FF / $00.'],
    ['$DC04 / $DC05', 'CIA 1 timer A', 'Read: counter. Write: latch. The KERNAL uses it for the 60 Hz system IRQ.'],
    ['$DC06 / $DC07', 'CIA 1 timer B', 'Second timer.'],
    ['$DC08-$DC0B', 'CIA 1 time of day', 'Tenths, seconds, minutes, hours (BCD).'],
    ['$DC0D', 'CIA 1 interrupt control', 'Read: flags (cleared on read). Write: bit 7 = 1 sets, 0 clears the mask bits. $7F switches all CIA 1 interrupts off.'],
    ['$DC0E / $DC0F', 'CIA 1 control A / B', 'Bit 0: start timer. Bit 3: one-shot. Bit 4: force load.'],
    ['$DD00', 'CIA 2 port A', 'Bits 0-1: VIC bank (inverted: %11 = $0000, %10 = $4000, %01 = $8000, %00 = $C000). Bits 3-7: serial bus.'],
    ['$DD01', 'CIA 2 port B', 'User port.'],
    ['$DD04-$DD07', 'CIA 2 timers A / B', 'Used for RS-232 and NMIs.'],
    ['$DD0D', 'CIA 2 interrupt control', 'Generates NMIs (not IRQs).']
  ];

  const ZP = [
    ['$00', 'CPU port data direction', 'Default $2F.'],
    ['$01', 'CPU port', 'Bits 0-2 select the memory configuration (see C64 memory map). Bit 4: cassette sense, bit 5: motor.'],
    ['$02', 'unused', 'Free for your programs.'],
    ['$2B / $2C', 'Start of BASIC', 'Normally $0801.'],
    ['$2D / $2E', 'Start of variables', 'End of the BASIC program.'],
    ['$37 / $38', 'Top of BASIC memory', 'Normally $A000.'],
    ['$90', 'Status byte ST', 'I/O status.'],
    ['$A0-$A2', 'Jiffy clock', '24-bit timer, counts 60 times per second.'],
    ['$C5', 'Last key (matrix code)', '$40 = no key.'],
    ['$C6', 'Keys in keyboard buffer', 'Write 0 to clear the buffer.'],
    ['$CC', 'Cursor blink', '0 = cursor is blinking.'],
    ['$D1 / $D2', 'Current screen line', 'Pointer to the screen line of the cursor.'],
    ['$D3', 'Cursor column', '0-39.'],
    ['$D6', 'Cursor row', '0-24.'],
    ['$FB-$FE', 'unused', 'Four free bytes - perfect for two pointers.'],
    ['$0277-$0280', 'Keyboard buffer', '10 bytes.'],
    ['$0286', 'Text colour', 'Colour used by CHROUT.'],
    ['$0288', 'Screen RAM page', 'High byte of the screen used by the KERNAL ($04).'],
    ['$0314 / $0315', 'IRQ vector', 'Default $EA31. Point it to your raster interrupt.'],
    ['$0316 / $0317', 'BRK vector', 'Default $FE66.'],
    ['$0318 / $0319', 'NMI vector', 'Default $FE47 (RESTORE key).'],
    ['$0326 / $0327', 'CHROUT vector', 'Default $F1CA.'],
    ['$033C-$03FB', 'Cassette buffer', '192 bytes, free when you do not use tapes.'],
    ['$FFFA / $FFFB', 'NMI hardware vector', 'In ROM: $FE43. Used when the KERNAL is switched off.'],
    ['$FFFC / $FFFD', 'Reset vector', '$FCE2.'],
    ['$FFFE / $FFFF', 'IRQ/BRK hardware vector', 'In ROM: $FF48 (saves registers, then JMP ($0314)).']
  ];

  const ROUTINES = [
    ['$E544', 'Clear screen', 'Clears the screen and sets the colour RAM to the current text colour.'],
    ['$E566', 'Cursor home', 'Puts the cursor in the top left corner.'],
    ['$EA31', 'Default IRQ handler', 'Jiffy clock, cursor blink, keyboard scan - then continues at $EA81. Jump here at the end of your IRQ once per frame.'],
    ['$EA81', 'IRQ exit', 'Pulls Y, X, A from the stack and does RTI. Jump here when you do not need the KERNAL tasks.'],
    ['$FCE2', 'Reset', 'Cold start of the C64.'],
    ['$FE66', 'Warm start (BRK)', 'Like RUN/STOP + RESTORE.'],
    ['$A474', 'BASIC "READY."', 'Prints READY and enters BASIC\'s main loop.'],
    ['$AB1E', 'Print string', 'Prints a zero-terminated string at A (lo) / Y (hi).'],
    ['$BDCD', 'Print number', 'Prints the 16-bit number A (hi) / X (lo) in decimal.']
  ];

  const COLORS = [
    [0, 'black', '#000000'], [1, 'white', '#ffffff'], [2, 'red', '#813338'], [3, 'cyan', '#75cec8'],
    [4, 'purple', '#8e3c97'], [5, 'green', '#56ac4d'], [6, 'blue', '#2e2c9b'], [7, 'yellow', '#edf171'],
    [8, 'orange', '#8e5029'], [9, 'brown', '#553800'], [10, 'light red', '#c46c71'], [11, 'dark grey', '#4a4a4a'],
    [12, 'grey', '#7b7b7b'], [13, 'light green', '#a9ff9f'], [14, 'light blue', '#706deb'], [15, 'light grey', '#b2b2b2']
  ];

  const PETSCII_CTRL = [
    [5, 'white'], [8, 'disable SHIFT + C='], [9, 'enable SHIFT + C='], [13, 'RETURN'], [14, 'switch to lower case'],
    [17, 'cursor down'], [18, 'reverse on'], [19, 'HOME'], [20, 'DELETE'], [28, 'red'], [29, 'cursor right'],
    [30, 'green'], [31, 'blue'], [129, 'orange'], [142, 'switch to upper case'], [144, 'black'], [145, 'cursor up'],
    [146, 'reverse off'], [147, 'CLEAR screen'], [148, 'INSERT'], [149, 'brown'], [150, 'light red'], [151, 'dark grey'],
    [152, 'grey'], [153, 'light green'], [154, 'light blue'], [155, 'light grey'], [156, 'purple'], [157, 'cursor left'],
    [158, 'yellow'], [159, 'cyan']
  ];

  const KEYMATRIX = [
    ['DEL', 'RETURN', 'CRSR right', 'F7', 'F1', 'F3', 'F5', 'CRSR down'],
    ['3', 'W', 'A', '4', 'Z', 'S', 'E', 'left SHIFT'],
    ['5', 'R', 'D', '6', 'C', 'F', 'T', 'X'],
    ['7', 'Y', 'G', '8', 'B', 'H', 'U', 'V'],
    ['9', 'I', 'J', '0', 'M', 'K', 'O', 'N'],
    ['+', 'P', 'L', '-', '.', ':', '@', ','],
    ['£', '*', ';', 'HOME', 'right SHIFT', '=', 'arrow up', '/'],
    ['1', 'arrow left', 'CTRL', '2', 'SPACE', 'C=', 'Q', 'RUN/STOP']
  ];

  const ACME_HINTS = [
    [/Value not defined/i, 'A symbol (label or constant) is used but never defined.', 'Check the spelling, define it ("name = value") or add the label. Local ".names" only work inside their zone/macro.'],
    [/Illegal combination of command and addressing mode/i, 'This instruction does not exist with this kind of operand.', 'Look up the instruction (F1 on the mnemonic) to see the allowed forms. Example: STA has no "#", LDX can only be indexed with Y.'],
    [/Number out of range/i, 'A value does not fit into the space it needs (e.g. more than 255 for "#" or !byte).', 'Use #<value / #>value for the low / high byte of a 16-bit value.'],
    [/Target out of range/i, 'A branch (BNE, BEQ ...) can only jump 128 bytes back or 127 bytes forward.', 'Invert the branch and use JMP: "beq +" / "jmp far_label" / "+".'],
    [/Garbage data at end of statement/i, 'There is something left on the line that ACME does not understand.', 'Comments start with ";". Several statements on one line are separated with ":".'],
    [/Syntax error/i, 'ACME could not read this line.', 'Check for typos, missing commas, quotes or brackets.'],
    [/Symbol already defined/i, 'The same label or constant is defined twice.', 'Rename one of them, or use !set if the value is meant to change.'],
    [/Label name not in leftmost column/i, 'A label is indented.', 'Labels start in column 1, instructions are indented. A misspelled mnemonic also ends up as a "label".'],
    [/Quotes still open/i, 'A string is not closed.', 'Add the closing quote character.'],
    [/Cannot open input file/i, 'A file for !source or !binary was not found.', 'File names are relative to the source file. Save the source next to its data files.'],
    [/Unknown pseudo opcode/i, 'There is no such !command.', 'See Help > ACME Pseudo Opcodes for all of them.'],
    [/Program counter is unset/i, 'Code or data appears before an address was set.', 'Start with "* = $0801" (or another address).'],
    [/Segment (starts inside|reached) another one/i, 'Two parts of the program use the same memory.', 'Change the "* =" addresses, or relocate a SID tune with Tools > Relocate SID.'],
    [/Macro not defined/i, 'A +macro call has no matching !macro definition (or the number of arguments differs).', 'Define the macro before you use it.'],
    [/Too late for postfix/i, 'A symbol got a +1/+2 postfix after it was used.', 'Put the postfix on the first definition.'],
    [/Hex digits are not given in pairs/i, '!hex needs two digits per byte.', 'Write "0f" instead of "f".'],
    [/Found '}' instead of end-of-file/i, 'There is a closing brace without an opening one.', 'Remove the "}" or add the block start.'],
    [/Found end-of-file instead of '}'/i, 'A block (!if, !for, !macro ...) is never closed.', 'Add the missing "}".'],
    [/Division by zero/i, 'A calculation divides by 0.', 'Check the expression.'],
    [/Using oversized addressing mode/i, 'A zero page symbol was defined after its first use, so ACME used 16-bit addressing (1 byte more, 1 cycle slower).', 'Define zero page symbols at the top of your source.'],
    [/Assembling buggy JMP/i, 'JMP ($xxFF) reads the high byte from $xx00 on the 6502.', 'Move the pointer so it does not start at the end of a page.'],
    [/Unknown processor/i, 'The !cpu name is not supported.', 'For the C64 use "!cpu 6510" (with illegal opcodes) or "!cpu 6502".'],
    [/No output file specified/i, 'ACME does not know where to write the program.', 'Add !to "name.prg", cbm (the editor normally passes the file name itself).']
  ];

  // ----------------------------------------------------------------- pages
  const pages = [];

  // ===================================================== Getting started
  pages.push(p('welcome', 'Welcome', `
<h1>Welcome to the C64 ACME EDITOR</h1>
<p>This editor helps you write machine language programs for the Commodore 64 with the ACME cross assembler - and learn on the way.</p>
<h2>How it works</h2>
<ol>
<li><b>Write</b> your source. Every line is checked while you type. Mistakes are underlined, the line below the editor explains what is wrong and how to fix it.</li>
<li><b>Watch the memory map</b> at the bottom. It shows which parts of the 64 KB your program uses - including included files such as SID music or pictures.</li>
<li><b>Press F5</b> to assemble with ACME and start the program in the VICE emulator.</li>
<li><b>Run a sanity check</b> (Shift+F7) to find things that assemble fine but will not work on a C64: wrong SID addresses, missing interrupt acknowledges, code under the ROM and more.</li>
<li><b>Save as PRG</b> (Ctrl+Shift+P) and decide whether to pack it with Exomizer.</li>
</ol>
<h2>Where to start</h2>
<ul>
<li>Open <b>Examples &gt; Hello World</b> and press F5.</li>
<li>Read <a data-page="first-program">Your first program</a> for a step by step introduction.</li>
<li>Place the cursor on any mnemonic (e.g. <code>lda</code>) and press <b>Ctrl+F1</b> for its reference page. Hover over numbers to see them in hex, decimal and binary.</li>
</ul>
<div class="note">The editor includes ACME (assembler), Exomizer (packer) and sidreloc (SID relocator). <b>VICE (emulator) is not included</b> - please install it once, see <a data-page="vice">Using VICE</a>. All paths can be changed in <b>Settings &gt; Tools</b>.</div>
`));

  pages.push(p('examples', 'Example programs', `
<h1>Example programs</h1>
<p>The editor comes with 20 fully commented example programs (<b>Examples</b> menu or Ctrl+Shift+E). Every example creates a runnable PRG: open it, press <b>F5</b>, read the comments, change something and run it again. Most examples end with SPACE.</p>
<p>The ideas for the examples 11-20 were picked from <a href="https://codebase64.net/doku.php?id=start">Codebase64</a>; the header of every example links the matching articles.</p>
<table>
<tr><th>#</th><th>Example</th><th>What you learn</th><th>Codebase64</th></tr>
<tr><td class="mono">01</td><td>Hello World</td><td>BASIC start line, CHROUT, loops</td><td>-</td></tr>
<tr><td class="mono">02</td><td>Raster Bars</td><td>changing colours on every raster line, bad lines</td><td><a href="https://codebase64.net/doku.php?id=base:rasterbars_source">rasterbars source</a></td></tr>
<tr><td class="mono">03</td><td>Soft Scroller</td><td>$D016 fine scrolling, two raster interrupts</td><td><a href="https://codebase64.net/doku.php?id=base:text_scroll">text scroll</a></td></tr>
<tr><td class="mono">04</td><td>Sprite Animation</td><td>sprite pointers, 9th X bit, generated graphics</td><td><a href="https://codebase64.net/doku.php?id=base:spriteintro">spriteintro</a></td></tr>
<tr><td class="mono">05</td><td>Sprite Scroller</td><td>reading the character ROM, ASL/ROL shifting</td><td><a href="https://codebase64.net/doku.php?id=base:scrolltext_using_sprites">scrolltext using sprites</a></td></tr>
<tr><td class="mono">06</td><td>Simple Plasma</td><td>sine tables, indirect indexed addressing</td><td><a href="https://codebase64.net/doku.php?id=base:colorcycleplasma">colorcycleplasma</a></td></tr>
<tr><td class="mono">07</td><td>Complex Plasma</td><td>dither charset, self-modifying code</td><td>-</td></tr>
<tr><td class="mono">08</td><td>Rotating 3D Square</td><td>3D maths in ACME, Bresenham lines, double buffering</td><td><a href="https://codebase64.net/doku.php?id=base:bresenham_s_line_algorithm">bresenham's line algorithm</a>, <a href="https://codebase64.net/doku.php?id=base:3d_rotation">3d rotation</a></td></tr>
<tr><td class="mono">09</td><td>SID Player 1x/2x/3x</td><td>PSID header, init/play, multispeed</td><td>-</td></tr>
<tr><td class="mono">10</td><td>Koala Viewer</td><td>multicolour bitmap, VIC banks</td><td><a href="https://codebase64.net/doku.php?id=base:calculate_vic_settings_for_showing_a_koala">calculate vic settings for showing a koala</a></td></tr>
<tr><td class="mono">11</td><td>Raster Split</td><td>table driven raster interrupt chain, $D018</td><td><a href="https://codebase64.net/doku.php?id=base:horizontal_raster_split">horizontal raster split</a>, <a href="https://codebase64.net/doku.php?id=base:introduction_to_raster_irqs">introduction to raster irqs</a></td></tr>
<tr><td class="mono">12</td><td>Parallax Starfield</td><td>copying the charset, redefined characters, 16-bit X</td><td><a href="https://codebase64.net/doku.php?id=base:starfield">starfield</a>, <a href="https://codebase64.net/doku.php?id=base:make_modified_character_sets">make modified character sets</a></td></tr>
<tr><td class="mono">13</td><td>DYCP Scroller</td><td>charset as bitmap canvas, unrolled loops, look-up tables</td><td><a href="https://codebase64.net/doku.php?id=magazines:chacking6">chacking6</a></td></tr>
<tr><td class="mono">14</td><td>Character Fire</td><td>SID noise random numbers, 2D buffer, dither charset</td><td><a href="https://codebase64.net/doku.php?id=base:4x4_charset_fire_with_lots_of_colors">4x4 charset fire with lots of colors</a></td></tr>
<tr><td class="mono">15</td><td>Colour Cycling Text</td><td>colour RAM, colour gradients</td><td><a href="https://codebase64.net/doku.php?id=base:colour_flashing_notewriter_style">colour flashing notewriter style</a></td></tr>
<tr><td class="mono">16</td><td>Joystick Sprite</td><td>$DC00, clamping, button edges, hex output, SID sound</td><td><a href="https://codebase64.net/doku.php?id=base:joystick_input_handling">joystick input handling</a></td></tr>
<tr><td class="mono">17</td><td>Random Maze</td><td>8-bit and 16-bit LFSR random generators</td><td><a href="https://codebase64.net/doku.php?id=base:small_fast_8-bit_prng">small fast 8-bit prng</a>, <a href="https://codebase64.net/doku.php?id=base:comparison_of_6502_random_generators">comparison of 6502 random generators</a></td></tr>
<tr><td class="mono">18</td><td>Key Codes</td><td>GETIN, hex / BCD decimal / binary output, PETSCII to screen code</td><td><a href="https://codebase64.net/doku.php?id=base:hexadecimal_to_decimal_conversion">hexadecimal to decimal conversion</a>, <a href="https://codebase64.net/doku.php?id=base:petscii_to_screencode">petscii to screencode</a></td></tr>
<tr><td class="mono">19</td><td>Open Borders</td><td>the RSEL border trick, sprites in the border</td><td><a href="https://codebase64.net/doku.php?id=vic:opening_the_top_bottom_borders">opening the top bottom borders</a></td></tr>
<tr><td class="mono">20</td><td>Hires Bitmap Plot</td><td>bitmap mode, fast plot with tables, colour clash</td><td><a href="https://codebase64.net/doku.php?id=base:dots_and_plots">dots and plots</a></td></tr>
</table>
<div class="note">An example opens as a new, unsaved copy, so the original stays unchanged. When you save it, the files it includes (music, pictures) are copied next to your file.</div>
`));

  pages.push(p('shortcuts', 'Keyboard shortcuts', `
<h1>Keyboard shortcuts</h1>
<p>On macOS use Cmd instead of Ctrl.</p>
<table>
<tr><th>Keys</th><th>Action</th></tr>
<tr><td>F5</td><td>Build and run in VICE</td></tr>
<tr><td>Shift+F5</td><td>Build, pack with Exomizer and run</td></tr>
<tr><td>F7</td><td>Check with the real ACME</td></tr>
<tr><td>Shift+F7</td><td>Sanity check (logic analysis)</td></tr>
<tr><td>Ctrl+B</td><td>Build the PRG next to the source</td></tr>
<tr><td>Ctrl+Shift+P</td><td>Save as PRG (with Exomizer option)</td></tr>
<tr><td>Ctrl+N / Ctrl+O / Ctrl+S</td><td>New / open / save</td></tr>
<tr><td>Ctrl+Shift+S</td><td>Save as</td></tr>
<tr><td>Ctrl+W</td><td>Close tab</td></tr>
<tr><td>Ctrl+F / Ctrl+H</td><td>Find / replace (regular expressions possible)</td></tr>
<tr><td>F3 / Shift+F3</td><td>Find next / previous</td></tr>
<tr><td>Ctrl+G</td><td>Go to line</td></tr>
<tr><td>Ctrl+Shift+U / Ctrl+Shift+L</td><td>Selection to UPPER / lower case</td></tr>
<tr><td>Ctrl+/</td><td>Comment / uncomment lines</td></tr>
<tr><td>Ctrl+D</td><td>Duplicate line</td></tr>
<tr><td>Ctrl+Shift+F</td><td>Tidy up columns</td></tr>
<tr><td>Alt+Up / Alt+Down</td><td>Move line up / down</td></tr>
<tr><td>Ctrl+Space</td><td>Auto completion</td></tr>
<tr><td>Ctrl+K</td><td>Number converter</td></tr>
<tr><td>Ctrl+M</td><td>Memory map</td></tr>
<tr><td>Ctrl+J</td><td>Problems panel</td></tr>
<tr><td>Ctrl+T</td><td>Day / night mode</td></tr>
<tr><td>Ctrl + / Ctrl - / Ctrl 0</td><td>Font size</td></tr>
<tr><td>F1 / Ctrl+F1</td><td>Help center / help for the word at the cursor</td></tr>
</table>
`));

  pages.push(p('first-program', 'Your first program', `
<h1>Your first program</h1>
<p>We write a program that changes the border colour, prints a text and returns to BASIC.</p>
<h2>1. Where does the program go?</h2>
<p>A program file (.prg) starts with its load address. Programs that should start with <code>RUN</code> are loaded to <code>$0801</code>, the start of BASIC memory. So the first line sets the program counter:</p>
<pre>        * = $0801</pre>
<h2>2. A BASIC line that starts our code</h2>
<p>BASIC only understands BASIC. We put a tiny BASIC program in front of our code: <code>10 SYS 2061</code>. SYS jumps to a machine language address.</p>
<pre>        !word basic_end   ; address of the next BASIC line
        !word 10          ; line number
        !byte $9e         ; the BASIC token of SYS
        !text "2061"      ; the address as text ($080d = 2061)
        !byte 0           ; end of the line
basic_end
        !word 0           ; end of the BASIC program
start                     ; this is $080d = 2061</pre>
<p>Use <b>Edit &gt; Insert &gt; BASIC Start Line</b> to insert this block. The sanity check warns you if the SYS number does not match your code.</p>
<h2>3. Some code</h2>
<pre>        lda #2            ; 2 = red
        sta $d020         ; border colour
        ldx #0
loop    lda text,x        ; read one character
        beq done          ; 0 = end
        jsr $ffd2         ; KERNAL CHROUT prints it
        inx
        bne loop
done    rts               ; back to BASIC

text    !pet "hello c64!", 13, 0</pre>
<h2>4. Run it</h2>
<p>Press <b>F5</b>. ACME assembles the program, VICE starts and runs it. Change the colour number and press F5 again.</p>
<h2>Rules worth knowing</h2>
<ul>
<li>Labels start in column 1, instructions are indented.</li>
<li><code>;</code> starts a comment.</li>
<li><code>#</code> means "this number itself" (immediate). Without <code>#</code> the number is an <i>address</i>: <code>lda 2</code> reads memory location 2!</li>
<li><code>$</code> = hexadecimal, <code>%</code> = binary, nothing = decimal.</li>
</ul>
`));

  // ===================================================== CPU
  pages.push(p('cpu', 'Registers and flags', `
<h1>The 6510 CPU: registers and flags</h1>
<p>The C64 uses the 6510, a 6502 with a built-in I/O port at addresses $00/$01. It runs at about 1 MHz (PAL: 985,248 cycles per second, 19,656 cycles per frame).</p>
<table>
<tr><th>Register</th><th>Size</th><th>Use</th></tr>
<tr><td>A (accumulator)</td><td>8 bit</td><td>All calculations (ADC, SBC, AND, ORA, EOR, shifts) happen here.</td></tr>
<tr><td>X, Y (index registers)</td><td>8 bit</td><td>Counters and indexes for addressing modes like <code>$0400,x</code>.</td></tr>
<tr><td>SP (stack pointer)</td><td>8 bit</td><td>Points into the stack $0100-$01FF. Grows downwards.</td></tr>
<tr><td>PC (program counter)</td><td>16 bit</td><td>Address of the next instruction.</td></tr>
<tr><td>P (status)</td><td>8 bit</td><td>The flags: N V - B D I Z C</td></tr>
</table>
<h2>Status flags</h2>
<table>
<tr><th>Flag</th><th>Name</th><th>Set when ...</th></tr>
<tr><td>N</td><td>Negative</td><td>bit 7 of the result is 1</td></tr>
<tr><td>V</td><td>Overflow</td><td>a signed addition/subtraction left the range -128..127 (also bit 6 after BIT)</td></tr>
<tr><td>B</td><td>Break</td><td>only exists on the stack: shows whether BRK or IRQ pushed the status</td></tr>
<tr><td>D</td><td>Decimal</td><td>ADC/SBC work in BCD (SED/CLD)</td></tr>
<tr><td>I</td><td>Interrupt disable</td><td>IRQs are blocked (SEI/CLI)</td></tr>
<tr><td>Z</td><td>Zero</td><td>the result is 0 (or a comparison found equality)</td></tr>
<tr><td>C</td><td>Carry</td><td>an addition overflowed / no borrow in a subtraction / bit shifted out</td></tr>
</table>
<h2>The stack</h2>
<p>JSR pushes the return address, RTS pulls it. PHA/PLA save A, PHP/PLP the flags. Interrupts push PC and P. The stack has 256 bytes - deep recursion or unbalanced PHA/PLA crash the program.</p>
`));

  pages.push(p('addrmodes', 'Addressing modes', `
<h1>Addressing modes</h1>
<p>The addressing mode decides where an instruction gets its value from. ACME picks zero page or absolute automatically from the size of the value.</p>
<table>
<tr><th>Mode</th><th>ACME syntax</th><th>Bytes</th><th>Meaning</th></tr>
<tr><td>Implied</td><td><code>inx</code></td><td>1</td><td>No operand.</td></tr>
<tr><td>Accumulator</td><td><code>asl</code></td><td>1</td><td>Works on A. ACME: write the mnemonic alone (not "asl a").</td></tr>
<tr><td>Immediate</td><td><code>lda #$10</code></td><td>2</td><td>The value itself.</td></tr>
<tr><td>Zero page</td><td><code>lda $fb</code></td><td>2</td><td>Address $00-$FF. Faster and shorter.</td></tr>
<tr><td>Zero page,X</td><td><code>lda $fb,x</code></td><td>2</td><td>Address + X, wraps inside the zero page.</td></tr>
<tr><td>Zero page,Y</td><td><code>ldx $fb,y</code></td><td>2</td><td>Only LDX, STX (and SAX/LAX).</td></tr>
<tr><td>Absolute</td><td><code>lda $d020</code></td><td>3</td><td>Any 16-bit address.</td></tr>
<tr><td>Absolute,X / ,Y</td><td><code>lda $0400,x</code></td><td>3</td><td>Address + X or Y. +1 cycle when a page boundary is crossed (loads).</td></tr>
<tr><td>Indirect</td><td><code>jmp ($0314)</code></td><td>3</td><td>Only JMP: jumps to the address stored at $0314/$0315.</td></tr>
<tr><td>Indexed indirect</td><td><code>lda ($fb,x)</code></td><td>2</td><td>Pointer at zero page address $fb+X. Rarely used.</td></tr>
<tr><td>Indirect indexed</td><td><code>lda ($fb),y</code></td><td>2</td><td>Pointer at $fb/$fc, plus Y. The way to access any memory with a pointer.</td></tr>
<tr><td>Relative</td><td><code>bne loop</code></td><td>2</td><td>Branches: -128..+127 bytes from the next instruction.</td></tr>
</table>
<h2>Forcing a mode in ACME</h2>
<p><code>lda+2 $fb</code> forces 16-bit addressing, <code>lda+1 label</code> forces zero page. Writing <code>$00fb</code> (with leading zeros) also forces 16 bit.</p>
<h2>A pointer example</h2>
<pre>ptr = $fb
        lda #&lt;$0400      ; low byte of the address
        sta ptr
        lda #&gt;$0400      ; high byte
        sta ptr+1
        ldy #0
        lda #1           ; screen code of "A"
        sta (ptr),y      ; writes to $0400 + Y</pre>
`));

  pages.push(p('opcodes', '6502 instruction set', '', { gen: 'opcodes' }));
  pages.push(p('illegal', 'Illegal opcodes', '', { gen: 'illegal' }));
  pages.push(p('opmatrix', 'Opcode matrix', '', { gen: 'opmatrix' }));

  pages.push(p('numbers', 'Number systems', `
<h1>Binary, decimal and hexadecimal</h1>
<p>A byte has 8 bits and can hold 256 values (0-255). Hexadecimal (base 16) is the natural way to write bytes: two digits per byte, 0-9 and A-F.</p>
<table>
<tr><th>Decimal</th><th>Hex (ACME: $)</th><th>Binary (ACME: %)</th></tr>
<tr><td>0</td><td>$00</td><td>%00000000</td></tr>
<tr><td>1</td><td>$01</td><td>%00000001</td></tr>
<tr><td>10</td><td>$0A</td><td>%00001010</td></tr>
<tr><td>15</td><td>$0F</td><td>%00001111</td></tr>
<tr><td>16</td><td>$10</td><td>%00010000</td></tr>
<tr><td>127</td><td>$7F</td><td>%01111111</td></tr>
<tr><td>128</td><td>$80</td><td>%10000000</td></tr>
<tr><td>255</td><td>$FF</td><td>%11111111</td></tr>
<tr><td>256</td><td>$0100</td><td>%1 00000000</td></tr>
<tr><td>2049</td><td>$0801</td><td></td></tr>
<tr><td>53280</td><td>$D020</td><td></td></tr>
<tr><td>65535</td><td>$FFFF</td><td></td></tr>
</table>
<h2>Converting</h2>
<p>Each hex digit is exactly 4 bits: $A7 = %1010 0111. To get decimal: $A7 = 10 * 16 + 7 = 167. The <b>Number converter</b> (Ctrl+K) does it for you and shows every bit.</p>
<h2>Low byte and high byte</h2>
<p>16-bit values are stored low byte first ("little endian"): $D020 is stored as $20, $D0. In ACME <code>&lt;value</code> is the low byte and <code>&gt;value</code> the high byte.</p>
<h2>Negative numbers (two's complement)</h2>
<p>With signed bytes, bit 7 is the sign: $00-$7F = 0..127, $80-$FF = -128..-1. To negate: invert all bits and add 1 (<code>eor #$ff : clc : adc #1</code>).</p>
<h2>Binary in ACME</h2>
<p>ACME also accepts "." for 0 and "#" for 1 in binary numbers - great for graphics: <code>!byte %..####..</code></p>
`));

  pages.push(p('branches', 'Comparing and branching', `
<h1>Comparing and branching</h1>
<p>CMP, CPX and CPY subtract without storing the result and set N, Z and C. Then a branch decides.</p>
<table>
<tr><th>Wanted</th><th>Unsigned (0-255)</th><th>Signed (-128..127)</th></tr>
<tr><td>A = value</td><td><code>cmp #v : beq</code></td><td>same</td></tr>
<tr><td>A &ne; value</td><td><code>cmp #v : bne</code></td><td>same</td></tr>
<tr><td>A &lt; value</td><td><code>cmp #v : bcc</code></td><td>see below, then <code>bmi</code></td></tr>
<tr><td>A &gt;= value</td><td><code>cmp #v : bcs</code></td><td>see below, then <code>bpl</code></td></tr>
<tr><td>A &gt; value</td><td><code>cmp #v+1 : bcs</code> (or <code>beq</code> + <code>bcs</code>)</td><td></td></tr>
<tr><td>A &lt;= value</td><td><code>cmp #v+1 : bcc</code></td><td></td></tr>
</table>
<h2>Signed comparison</h2>
<pre>        sec
        sbc #value        ; A - value
        bvc +             ; no overflow: N is correct
        eor #$80          ; overflow: flip N
+       bmi less          ; N = 1  -&gt;  A &lt; value (signed)</pre>
<h2>Branch range</h2>
<p>A branch can jump at most 128 bytes back or 127 bytes forward. If the editor reports "Branch target out of range", invert the condition and use JMP:</p>
<pre>        bne far_away      ; too far ...

        beq +             ; ... becomes this
        jmp far_away
+</pre>
<h2>Anonymous labels</h2>
<p>ACME allows short labels <code>-</code> and <code>+</code>. <code>bne -</code> jumps to the previous line that starts with <code>-</code>, <code>beq +</code> to the next line that starts with <code>+</code>. Use <code>--</code>, <code>++</code> etc. for more of them.</p>
`));

  pages.push(p('maths', '16-bit maths and multiplication', `
<h1>16-bit maths</h1>
<h2>Adding</h2>
<pre>        clc
        lda num1          ; low bytes first
        adc num2
        sta result
        lda num1+1        ; then the high bytes - the carry
        adc num2+1        ; from the low bytes is added
        sta result+1</pre>
<h2>Subtracting</h2>
<pre>        sec
        lda num1
        sbc num2
        sta result
        lda num1+1
        sbc num2+1
        sta result+1</pre>
<h2>Incrementing a 16-bit pointer</h2>
<pre>        inc ptr
        bne +
        inc ptr+1
+</pre>
<h2>Multiplying by powers of two</h2>
<p><code>asl</code> multiplies by 2, <code>lsr</code> divides by 2. For 16 bit use <code>asl lo : rol hi</code>. Multiply by 40 (one screen row): x*40 = x*32 + x*8. Or use a table generated by ACME:</p>
<pre>row_lo  !for r, 0, 24 { !byte &lt;($0400 + r * 40) }
row_hi  !for r, 0, 24 { !byte &gt;($0400 + r * 40) }</pre>
<h2>BCD for scores</h2>
<p>With <code>sed</code> ADC/SBC count in decimal: $09 + 1 = $10. Always <code>cld</code> afterwards.</p>
`));

  // ===================================================== ACME
  pages.push(p('acme-intro', 'ACME basics', `
<h1>ACME basics</h1>
<p>ACME is a cross assembler by Marco Baye: it runs on your computer and creates programs for the 6502 family. It is free software (GPL).</p>
<h2>Lines</h2>
<pre>label   mnemonic operand   ; comment</pre>
<ul>
<li>Labels start in column 1. ACME warns about indented labels.</li>
<li>Several statements on one line are separated with <code>:</code> - e.g. <code>lda #0 : sta $d020</code></li>
<li>Pseudo opcodes (assembler commands) start with <code>!</code>, e.g. <code>!byte</code>.</li>
<li>Mnemonics and pseudo opcodes are not case sensitive, symbols are.</li>
</ul>
<h2>Symbols</h2>
<table>
<tr><th>Kind</th><th>Example</th><th>Visible</th></tr>
<tr><td>Global</td><td><code>screen = $0400</code>, <code>loop</code></td><td>everywhere</td></tr>
<tr><td>Local</td><td><code>.loop</code></td><td>inside the current !zone or macro</td></tr>
<tr><td>Cheap local</td><td><code>@loop</code></td><td>between two global labels</td></tr>
<tr><td>Anonymous</td><td><code>-</code> <code>+</code> <code>--</code> <code>++</code></td><td>"-" backwards, "+" forwards</td></tr>
</table>
<h2>Program counter</h2>
<p><code>* = $c000</code> sets the address for the following code. <code>*</code> inside an expression is the current address: <code>jmp *</code> is an endless loop.</p>
<h2>Output</h2>
<p><code>!to "name.prg", cbm</code> chooses the output file. The editor passes its own output name to ACME, so !to mainly gives the default file name.</p>
<h2>Passes</h2>
<p>ACME reads the source several times ("passes") until all forward references are known. Symbols used before their definition are fine - except for zero page addresses, which then get 16-bit addressing.</p>
`));

  pages.push(p('acme-po', 'ACME pseudo opcodes', '', { gen: 'pseudo' }));

  pages.push(p('acme-expr', 'Expressions and operators', `
<h1>Expressions and operators</h1>
<h2>Number formats</h2>
<table>
<tr><th>Example</th><th>Meaning</th></tr>
<tr><td><code>128</code>, <code>1.5</code></td><td>decimal (integer or floating point)</td></tr>
<tr><td><code>$d020</code>, <code>0xd020</code></td><td>hexadecimal</td></tr>
<tr><td><code>%1010</code>, <code>0b1010</code>, <code>%..##..##</code></td><td>binary ("." = 0, "#" = 1)</td></tr>
<tr><td><code>&amp;17</code></td><td>octal</td></tr>
<tr><td><code>'a'</code>, <code>"a"</code></td><td>character (value depends on !convtab)</td></tr>
<tr><td><code>*</code></td><td>current program counter</td></tr>
</table>
<h2>Operators (highest priority first)</h2>
<table>
<tr><th>Operator</th><th>Meaning</th></tr>
<tr><td><code>sin() cos() tan() arcsin() arccos() arctan() int() float() addr()</code></td><td>functions (angles in radians)</td></tr>
<tr><td><code>!v</code>, <code>NOT v</code></td><td>bitwise complement</td></tr>
<tr><td><code>v ^ w</code></td><td><b>power</b> (not XOR!)</td></tr>
<tr><td><code>-v</code></td><td>negation</td></tr>
<tr><td><code>* / DIV % MOD</code></td><td>multiply, divide, integer divide, remainder</td></tr>
<tr><td><code>+ -</code></td><td>add, subtract</td></tr>
<tr><td><code>&lt;&lt; &gt;&gt; &gt;&gt;&gt;</code> (ASL, ASR, LSR)</td><td>shifts</td></tr>
<tr><td><code>&lt;v &gt;v ^v</code></td><td>low byte, high byte, bank byte</td></tr>
<tr><td><code>&lt;= &lt; &gt;= &gt;</code></td><td>comparisons</td></tr>
<tr><td><code>!= &lt;&gt;</code></td><td>not equal</td></tr>
<tr><td><code>=</code></td><td>equal (one "=" only)</td></tr>
<tr><td><code>&amp;</code> AND</td><td>bitwise and</td></tr>
<tr><td><code>XOR</code></td><td>bitwise exclusive or (there is no symbol for it)</td></tr>
<tr><td><code>|</code> OR</td><td>bitwise or</td></tr>
</table>
<div class="note"><code>&lt;</code> and <code>&gt;</code> have a lower priority than <code>+</code>: <code>#&lt;text+1</code> is the low byte of (text+1).</div>
<h2>Tables calculated by ACME</h2>
<pre>sine    !for i, 0, 255 {
            !byte 128 + 127 * sin(float(i) * 2 * 3.14159265 / 256)
        }</pre>
`));

  pages.push(p('acme-macros', 'Macros, loops, conditions', `
<h1>Macros, loops and conditions</h1>
<h2>Macros</h2>
<pre>!macro set_colors .border, .background {
        lda #.border
        sta $d020
        lda #.background
        sta $d021
}

        +set_colors 0, 6      ; call: black border, blue background</pre>
<p>Parameters are usually local symbols (with a dot). Each call gets its own zone, so local labels inside a macro do not collide. Macros must be defined before they are used.</p>
<h2>Loops at assembly time</h2>
<pre>        !for i, 0, 7 {
            sta $d027 + i     ; creates 8 instructions
        }</pre>
<p><code>!for SYMBOL, START, END</code> counts from START to END inclusive (downwards if START &gt; END). Inside the loop you can use <code>!set</code> to change other symbols.</p>
<h2>Conditional assembly</h2>
<pre>DEBUG = 1
        !if DEBUG = 1 {
            inc $d020         ; only assembled when DEBUG is 1
        } else {
            nop
        }
        !ifdef MUSIC { jsr MUSIC_PLAY }</pre>
<h2>Errors of your own</h2>
<pre>        !if * &gt; $1000 { !error "code is too big, it reaches the music" }</pre>
`));

  pages.push(p('acme-errors', 'ACME error messages', '', { gen: 'acme-errors' }));

  pages.push(p('acme-cli', 'How the editor calls ACME', `
<h1>How the editor calls ACME</h1>
<p>When you check, build or run, the editor saves a temporary copy of your source and calls:</p>
<pre>acme -v1 -f cbm -o OUTPUT.prg -I SOURCE_FOLDER source.asm</pre>
<ul>
<li><code>-f cbm</code>: PRG format with a 2-byte load address.</li>
<li><code>-o</code>: the output file. It overrides the name given with !to (ACME's warning about this is hidden).</li>
<li><code>-I</code>: the folder of your source, so !source and !binary find their files.</li>
<li><code>-v1</code>: prints the start and end address.</li>
<li><code>--vicelabels</code>: writes a label file for the VICE monitor (when enabled in the VICE settings).</li>
</ul>
<p>All messages from ACME appear in the <b>Output</b> panel; errors and warnings are also shown in the source.</p>
`));

  // ===================================================== C64
  pages.push(p('memmap', 'C64 memory map', `
<h1>C64 memory map</h1>
<table>
<tr><th>Address</th><th>Size</th><th>Content</th></tr>
<tr><td>$0000-$0001</td><td>2 B</td><td>CPU port (memory configuration)</td></tr>
<tr><td>$0002-$00FF</td><td>254 B</td><td>Zero page: BASIC/KERNAL variables. Free: $02, $FB-$FE</td></tr>
<tr><td>$0100-$01FF</td><td>256 B</td><td>Stack</td></tr>
<tr><td>$0200-$03FF</td><td>512 B</td><td>KERNAL/BASIC work area, vectors ($0314 IRQ), cassette buffer $033C-$03FB</td></tr>
<tr><td>$0400-$07E7</td><td>1000 B</td><td>Screen RAM (40 x 25 characters)</td></tr>
<tr><td>$07F8-$07FF</td><td>8 B</td><td>Sprite pointers</td></tr>
<tr><td>$0801-$9FFF</td><td>38 KB</td><td>BASIC program memory - your programs usually start at $0801</td></tr>
<tr><td>$A000-$BFFF</td><td>8 KB</td><td>BASIC ROM (RAM underneath)</td></tr>
<tr><td>$C000-$CFFF</td><td>4 KB</td><td>Free RAM, not used by BASIC</td></tr>
<tr><td>$D000-$D3FF</td><td>1 KB</td><td>VIC-II (graphics)</td></tr>
<tr><td>$D400-$D7FF</td><td>1 KB</td><td>SID (sound)</td></tr>
<tr><td>$D800-$DBFF</td><td>1 KB</td><td>Colour RAM (4 bits per character)</td></tr>
<tr><td>$DC00-$DCFF</td><td>256 B</td><td>CIA 1: keyboard, joysticks, timers, IRQ</td></tr>
<tr><td>$DD00-$DDFF</td><td>256 B</td><td>CIA 2: VIC bank, serial bus, NMI</td></tr>
<tr><td>$DE00-$DFFF</td><td>512 B</td><td>I/O 1 / I/O 2 for cartridges</td></tr>
<tr><td>$D000-$DFFF</td><td>4 KB</td><td>Alternatively: character ROM or RAM (see $01)</td></tr>
<tr><td>$E000-$FFFF</td><td>8 KB</td><td>KERNAL ROM (RAM underneath)</td></tr>
</table>
<h2>Memory configuration ($01)</h2>
<p>Bits 0-2 of address $01 decide what the CPU sees at $A000, $D000 and $E000. Writing always goes to the RAM underneath.</p>
<table>
<tr><th>$01</th><th>$A000-$BFFF</th><th>$D000-$DFFF</th><th>$E000-$FFFF</th></tr>
<tr><td>$37 (default)</td><td>BASIC ROM</td><td>I/O</td><td>KERNAL ROM</td></tr>
<tr><td>$36</td><td>RAM</td><td>I/O</td><td>KERNAL ROM</td></tr>
<tr><td>$35</td><td>RAM</td><td>I/O</td><td>RAM</td></tr>
<tr><td>$34</td><td>RAM</td><td>RAM</td><td>RAM</td></tr>
<tr><td>$33</td><td>BASIC ROM</td><td>character ROM</td><td>KERNAL ROM</td></tr>
<tr><td>$32</td><td>RAM</td><td>character ROM</td><td>KERNAL ROM</td></tr>
<tr><td>$31</td><td>RAM</td><td>character ROM</td><td>RAM</td></tr>
<tr><td>$30</td><td>RAM</td><td>RAM</td><td>RAM</td></tr>
</table>
<p>Switch interrupts off (<code>sei</code>) before you remove the KERNAL or the I/O area.</p>
<h2>What the VIC-II sees</h2>
<p>The VIC-II always reads 16 KB (a "bank"), chosen with bits 0-1 of $DD00. It never sees the BASIC or KERNAL ROM, but in banks 0 and 2 it sees the character ROM at $1000-$1FFF / $9000-$9FFF.</p>
<table>
<tr><th>$DD00 bits 0-1</th><th>Bank</th><th>Notes</th></tr>
<tr><td>%11</td><td>$0000-$3FFF</td><td>default, char ROM at $1000-$1FFF</td></tr>
<tr><td>%10</td><td>$4000-$7FFF</td><td>no char ROM - free for graphics</td></tr>
<tr><td>%01</td><td>$8000-$BFFF</td><td>char ROM at $9000-$9FFF</td></tr>
<tr><td>%00</td><td>$C000-$FFFF</td><td>no char ROM, I/O area not visible to the VIC</td></tr>
</table>
`));

  pages.push(p('zeropage', 'Important system addresses', `<h1>Important system addresses</h1><p>Useful locations in the zero page, the KERNAL work area and the vectors.</p>${table(['Address', 'Name', 'Notes'], ZP)}`));
  pages.push(p('vic', 'VIC-II registers', `<h1>VIC-II registers ($D000-$D02E)</h1>
<p>The VIC-II creates the picture: 320 x 200 pixels, 40 x 25 characters, 8 sprites, 16 colours. A PAL frame has 312 raster lines of 63 cycles.</p>
${table(['Address', 'Register', 'Description'], VIC)}
<h2>Graphics modes</h2>
<table>
<tr><th>Mode</th><th>$D011</th><th>$D016</th><th>Notes</th></tr>
<tr><td>Standard text</td><td>bit 5 = 0, bit 6 = 0</td><td>bit 4 = 0</td><td>40 x 25 characters, 1 colour each</td></tr>
<tr><td>Multicolour text</td><td>bit 5 = 0</td><td>bit 4 = 1</td><td>colour RAM bit 3 = 1: 4 x 8 double-wide pixels, 4 colours</td></tr>
<tr><td>Extended colour</td><td>bit 6 = 1</td><td>bit 4 = 0</td><td>64 characters, 4 background colours</td></tr>
<tr><td>Hires bitmap</td><td>bit 5 = 1</td><td>bit 4 = 0</td><td>320 x 200, 2 colours per 8 x 8 cell (from screen RAM)</td></tr>
<tr><td>Multicolour bitmap</td><td>bit 5 = 1</td><td>bit 4 = 1</td><td>160 x 200, 4 colours per cell (Koala format)</td></tr>
</table>
<h2>$D018 quick reference (bank 0)</h2>
<pre>value = (screen / $400) * 16 + (charset / $800) * 2
$15 = screen $0400, ROM charset (upper case)
$17 = screen $0400, ROM charset (lower case)
$18 = screen $0400, charset at $2000  (or bitmap at $2000)
$1C = screen $0400, charset at $3000</pre>
`));

  pages.push(p('sprites', 'Sprites', `
<h1>Sprites</h1>
<p>A sprite is a 24 x 21 pixel graphic that can be placed anywhere, independent of the characters. The VIC-II has 8 of them.</p>
<h2>Five steps to a sprite</h2>
<ol>
<li><b>Data:</b> 63 bytes (3 bytes per line, 21 lines) at an address divisible by 64, e.g. $2000.</li>
<li><b>Pointer:</b> the byte at screen RAM + $3F8 + n (normally $07F8 + n) holds address / 64. $2000 / 64 = 128.</li>
<li><b>Position:</b> $D000 + 2n = X, $D001 + 2n = Y. X > 255 needs bit n in $D010.</li>
<li><b>Colour:</b> $D027 + n.</li>
<li><b>Switch on:</b> bit n in $D015.</li>
</ol>
<pre>        lda #128          ; $2000 / 64
        sta $07f8
        lda #172 : sta $d000
        lda #139 : sta $d001
        lda #7   : sta $d027
        lda #%00000001
        sta $d015

        * = $2000
        !byte %00000000,%01111110,%00000000   ; line 1 ... (21 lines)</pre>
<h2>Coordinates</h2>
<p>The visible screen starts at X = 24, Y = 50 (top left corner of a sprite exactly at the first text character). With borders open, sprites can go further out.</p>
<h2>Multicolour sprites</h2>
<p>Bit n of $D01C: 12 x 21 double-wide pixels. Bit pairs: %00 transparent, %01 = $D025, %10 = sprite colour, %11 = $D026.</p>
<p>See the examples <b>Sprite Animation</b> and <b>Sprite Scroller</b>.</p>
`));

  pages.push(p('raster', 'Raster interrupts and timing', `
<h1>Raster interrupts and timing</h1>
<p>The VIC-II draws the picture line by line. $D012 tells you the current line. A raster interrupt (IRQ) lets the CPU run code exactly when the beam reaches a certain line - the basis of almost every C64 demo effect.</p>
<h2>PAL timing</h2>
<ul>
<li>312 lines per frame, 50 frames per second</li>
<li>63 cycles per line, 19,656 cycles per frame</li>
<li>Visible text area: lines 51-250 (with the default y scroll)</li>
<li>"Bad lines": at the first line of every text row the VIC-II needs 40 extra cycles to read the characters - the CPU is stopped. Code that changes colours line by line jitters there.</li>
</ul>
<h2>Setting up a raster IRQ</h2>
<pre>        sei                   ; no interrupts during setup
        lda #$7f
        sta $dc0d             ; CIA 1 timer interrupts off
        lda $dc0d             ; acknowledge pending CIA interrupts
        lda #&lt;irq
        sta $0314             ; IRQ vector -&gt; our routine
        lda #&gt;irq
        sta $0315
        lda #100
        sta $d012             ; raster line 100
        lda $d011
        and #$7f              ; bit 8 of the line = 0
        sta $d011
        lda #1
        sta $d01a             ; enable the raster interrupt
        cli
        rts

irq     lda #$ff
        sta $d019             ; acknowledge - very important!
        inc $d020             ; do something
        jmp $ea31             ; continue with the KERNAL IRQ</pre>
<p>Several IRQs per frame are chained by setting a new line and a new vector inside the handler (see the examples Soft Scroller and SID Player). End all but one of them with <code>jmp $ea81</code>.</p>
<h2>Counting cycles</h2>
<p>Every instruction page in this help lists its cycles. Indexed loads that cross a page cost one more cycle, taken branches one more (two when crossing a page).</p>
`));

  pages.push(p('sid', 'SID registers', `<h1>SID registers ($D400-$D41C)</h1>
<p>The SID has 3 voices with 4 waveforms each, ADSR envelopes, a multi-mode filter and 16 volume steps.</p>
${table(['Address', 'Register', 'Description'], SID)}
<h2>ADSR timing</h2>
<table>
<tr><th>Value</th><th>Attack</th><th>Decay / Release</th></tr>
${[['0', '2 ms', '6 ms'], ['1', '8 ms', '24 ms'], ['2', '16 ms', '48 ms'], ['3', '24 ms', '72 ms'], ['4', '38 ms', '114 ms'], ['5', '56 ms', '168 ms'], ['6', '68 ms', '204 ms'], ['7', '80 ms', '240 ms'], ['8', '100 ms', '300 ms'], ['9', '250 ms', '750 ms'], ['10', '500 ms', '1.5 s'], ['11', '800 ms', '2.4 s'], ['12', '1 s', '3 s'], ['13', '3 s', '9 s'], ['14', '5 s', '15 s'], ['15', '8 s', '24 s']].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
</table>
<h2>A beep</h2>
<pre>        lda #15 : sta $d418   ; volume
        lda #$09 : sta $d405  ; attack 0, decay 9
        lda #$00 : sta $d406  ; sustain 0, release 0
        lda #$45 : sta $d400  ; frequency $1d45 = 440 Hz (PAL)
        lda #$1d : sta $d401
        lda #$21 : sta $d404  ; sawtooth + gate on</pre>
<p>To restart a note, the gate bit must be 0 for a short time (e.g. one frame) before it is set again.</p>
`));

  pages.push(p('cia', 'CIA registers and keyboard', `<h1>CIA 1 and CIA 2</h1>
${table(['Address', 'Register', 'Description'], CIA)}
<h2>Reading the keyboard directly</h2>
<p>Write a column mask to $DC00 (0 = selected), read the rows from $DC01 (0 = key down).</p>
<pre>        lda #%01111111        ; column 7
        sta $dc00
        lda $dc01
        and #%00010000        ; row 4 = SPACE
        beq space_pressed</pre>
<h2>Keyboard matrix</h2>
<table><tr><th>column \\ row</th>${[0, 1, 2, 3, 4, 5, 6, 7].map(r => `<th>${r}</th>`).join('')}</tr>
${KEYMATRIX.map((row, c) => `<tr><td>${c}</td>${row.map(k => `<td>${k}</td>`).join('')}</tr>`).join('')}
</table>
<h2>Joystick</h2>
<pre>        lda $dc00             ; joystick in port 2
        and #%00010000        ; fire button
        beq fire              ; 0 = pressed</pre>
`));

  pages.push(p('colors', 'C64 colours', `<h1>The 16 C64 colours</h1>
<table><tr><th>Value</th><th>Colour</th><th>Name</th></tr>
${COLORS.map(c => `<tr><td>${c[0]} / $${c[0].toString(16).toUpperCase()}</td><td><span class="swatch" style="background:${c[2]}"></span></td><td>${c[1]}</td></tr>`).join('')}
</table>
<h2>Sorted by brightness</h2>
<p>For smooth colour fades use this order: 0 black, 6 blue, 9 brown, 11 dark grey, 2 red, 4 purple, 8 orange, 12 grey, 14 light blue, 5 green, 10 light red, 15 light grey, 3 cyan, 13 light green, 7 yellow, 1 white.</p>
`));

  pages.push(p('petscii', 'PETSCII and screen codes', '', { gen: 'petscii', ctrl: PETSCII_CTRL }));
  pages.push(p('kernal', 'KERNAL routines', `<h1>KERNAL jump table</h1>
<p>The KERNAL is the operating system in ROM ($E000-$FFFF). These entry points stay the same in all C64 versions. Call them with JSR.</p>
${table(['Address', 'Name', 'Description', 'Parameters'], KERNAL)}
<h2>Other useful ROM routines</h2>
${table(['Address', 'Name', 'Description'], ROUTINES)}
<h2>Example: printing with CHROUT</h2>
<pre>        lda #147              ; clear screen
        jsr $ffd2
        lda #"a"              ; character literals use the current !ct table
        jsr $ffd2</pre>
`));

  // ===================================================== techniques
  pages.push(p('scrolling', 'Smooth scrolling', `
<h1>Smooth scrolling</h1>
<p>The VIC-II can shift the whole screen by 0-7 pixels: $D016 bits 0-2 horizontally, $D011 bits 0-2 vertically. After 8 pixels the characters themselves are moved one position and the fine scroll value starts again.</p>
<pre>        lda xscroll
        sec
        sbc #1                ; one pixel to the left
        and #7
        sta xscroll
        cmp #7
        bne +
        jsr move_chars_left   ; every 8 pixels
+       lda $d016
        and #%11111000
        ora xscroll
        sta $d016</pre>
<p>Switch to 38 columns ($D016 bit 3 = 0) to hide the column where new characters appear. To scroll only a part of the screen, change $D016 in a raster interrupt above that part and set it back below. Example: <b>Soft Scroller</b>.</p>
`));

  pages.push(p('music', 'Using SID music', `
<h1>Using SID music</h1>
<p>A .sid file contains a music player plus the song, prefixed by a header (the PSID format of the High Voltage SID Collection). You call two routines: <b>init</b> once, <b>play</b> once per frame.</p>
<h2>The PSID header (version 2)</h2>
<table>
<tr><th>Offset</th><th>Size</th><th>Content</th></tr>
<tr><td>$00</td><td>4</td><td>"PSID" or "RSID"</td></tr>
<tr><td>$04</td><td>2</td><td>version</td></tr>
<tr><td>$06</td><td>2</td><td>data offset (header size: $76 or $7C)</td></tr>
<tr><td>$08</td><td>2</td><td>load address (0 = first two bytes of the data)</td></tr>
<tr><td>$0A</td><td>2</td><td>init address</td></tr>
<tr><td>$0C</td><td>2</td><td>play address</td></tr>
<tr><td>$0E</td><td>2</td><td>number of songs</td></tr>
<tr><td>$10</td><td>2</td><td>start song</td></tr>
<tr><td>$12</td><td>4</td><td>speed bits (0 = 50 Hz VBI, 1 = CIA timer)</td></tr>
<tr><td>$16</td><td>32</td><td>name</td></tr>
<tr><td>$36</td><td>32</td><td>author</td></tr>
<tr><td>$56</td><td>32</td><td>released</td></tr>
<tr><td>$76</td><td>6</td><td>flags, relocation info, second SID (version 2+)</td></tr>
</table>
<p>All header values are big endian. The editor shows this information in <b>Tools &gt; SID File Info</b>.</p>
<h2>Including a tune</h2>
<pre>        * = $1000             ; the load address from the header
        !bin "music.sid",, $7e ; skip $7c header + 2 bytes load address

        lda #0                ; song number - 1
        jsr $1000             ; init
        ...
        jsr $1003             ; play, once per frame (raster IRQ)</pre>
<p>The memory map shows the tune as "SID music". The sanity check warns you when the address or skip value is wrong.</p>
<h2>Moving a tune: sidreloc</h2>
<p>If the tune collides with your code, <b>Tools &gt; Relocate SID</b> moves it to another address. sidreloc (by Linus Åkesson) runs the player in an emulator, finds all addresses that must change and checks that the music still sounds the same.</p>
<h2>Multispeed tunes</h2>
<p>Some tunes must be called 2, 3, 4 ... times per frame. Use several raster interrupts per frame, evenly spaced (see the example <b>SID Player</b>).</p>
`));

  pages.push(p('bitmap', 'Bitmaps and Koala pictures', `
<h1>Bitmaps and Koala pictures</h1>
<p>In bitmap mode each of the 1000 character cells is an 8 x 8 pixel block from the bitmap (8000 bytes). Colours come from screen RAM (and colour RAM in multicolour mode).</p>
<h2>Koala Painter format (.kla / .koa)</h2>
<table>
<tr><th>Offset</th><th>Size</th><th>Content</th></tr>
<tr><td>0</td><td>2</td><td>load address ($6000)</td></tr>
<tr><td>2</td><td>8000</td><td>bitmap</td></tr>
<tr><td>8002</td><td>1000</td><td>screen RAM: colours for bit pairs %01 (high nibble) and %10 (low nibble)</td></tr>
<tr><td>9002</td><td>1000</td><td>colour RAM: colour for bit pair %11</td></tr>
<tr><td>10002</td><td>1</td><td>background colour (%00)</td></tr>
</table>
<h2>Showing it</h2>
<ol>
<li>Choose a VIC bank that contains the bitmap ($DD00).</li>
<li>Copy the screen colours into a screen RAM inside that bank and point $D018 at it and at the bitmap.</li>
<li>Copy the colour data to $D800, set $D021.</li>
<li>Switch on bitmap + multicolour: $D011 = $3B, $D016 = $18.</li>
</ol>
<p>Example: <b>Koala Picture Viewer</b>.</p>
`));

  pages.push(p('speed', 'Speed tricks', `
<h1>Speed tricks</h1>
<ul>
<li><b>Tables instead of maths.</b> Let ACME calculate sine tables, multiplication tables or screen line addresses.</li>
<li><b>Zero page.</b> Zero page instructions are shorter and one cycle faster.</li>
<li><b>Unrolling.</b> <code>!for</code> repeats code without a loop counter: no INX/CPX/BNE overhead.</li>
<li><b>Self-modifying code.</b> Write directly into the operand of an instruction: <code>sta load+1</code> changes the address of <code>load lda $1234,x</code>. Faster than a pointer, but the code must be in RAM.</li>
<li><b>Count down to zero.</b> <code>dex : bne loop</code> saves the compare.</li>
<li><b>Avoid page crossing</b> in time-critical loops: align tables with <code>!align 255, 0</code>.</li>
</ul>
`));

  pages.push(p('exomizer', 'Packing with Exomizer', `
<h1>Packing with Exomizer</h1>
<p>Exomizer (by Magnus Lind) compresses a PRG and adds a small decruncher ("SFX" = self-extracting). The packed program still starts with RUN, unpacks itself and jumps to your code.</p>
<p>When you choose <b>Save as PRG</b>, the editor asks whether you want to pack the file. Options:</p>
<ul>
<li><b>Start address:</b> "sys" uses the SYS address of your BASIC start line. For programs without a BASIC line, give the address to jump to.</li>
<li><b>Effect:</b> none, or flashing border colours while unpacking.</li>
</ul>
<p>The editor calls: <code>exomizer sfx sys -n -o packed.prg program.prg</code></p>
<p>Packing is especially worth it when your program has gaps (music at $1000, graphics at $6000 ...): the gaps compress to almost nothing.</p>
`));

  pages.push(p('vice', 'Using VICE', `
<h1>Using VICE</h1>
<h2>Installing VICE</h2>
<p>VICE is <b>not included</b> in the C64 ACME EDITOR - you install it once yourself. Download page: <a href="https://vice-emu.sourceforge.io/index.html#download">vice-emu.sourceforge.io</a>.</p>
<ul>
<li><b>Windows:</b> download the GTK3 VICE zip and unpack it, e.g. to <code>C:\VICE</code>. If the editor does not find it, choose <code>bin\x64sc.exe</code> in <b>Settings &gt; Tools</b>.</li>
<li><b>macOS:</b> download the VICE <code>.dmg</code> and copy VICE to <i>Applications</i>, or <code>brew install vice</code>.</li>
<li><b>Linux:</b> <code>sudo apt install vice</code> (or your package manager), or the Flatpak <code>net.sf.VICE</code>. As tool path you can also enter a command such as <code>flatpak run net.sf.VICE</code>. Some distributions ship VICE without the C64 ROMs - see the VICE documentation.</li>
</ul>
<p>If VICE is missing when you press F5, the editor shows these steps and a <b>Locate x64sc...</b> button.</p>
<h2>Running programs</h2>
<p>VICE is the most accurate C64 emulator. The editor starts <code>x64sc</code> with your program (autostart). All options are in <b>Emulator &gt; VICE Settings</b>: C64 model (PAL/NTSC), SID chip, borders, joystick ports, warp mode during loading and more.</p>
<h2>Useful VICE keys</h2>
<table>
<tr><th>Key</th><th>Action</th></tr>
<tr><td>Alt+H (Cmd+H on macOS)</td><td>Open the monitor (debugger)</td></tr>
<tr><td>Alt+W</td><td>Warp mode on/off</td></tr>
<tr><td>Alt+R / Ctrl+Alt+R</td><td>Soft / hard reset</td></tr>
<tr><td>Alt+J</td><td>Swap joystick ports</td></tr>
<tr><td>Alt+Q</td><td>Quit VICE</td></tr>
</table>
<h2>Monitor commands</h2>
<table>
<tr><th>Command</th><th>Meaning</th></tr>
<tr><td><code>m 0801</code></td><td>show memory</td></tr>
<tr><td><code>d 080d</code></td><td>disassemble</td></tr>
<tr><td><code>r</code></td><td>show registers</td></tr>
<tr><td><code>break 0810</code></td><td>set a breakpoint</td></tr>
<tr><td><code>z</code> / <code>n</code></td><td>step into / step over</td></tr>
<tr><td><code>g 080d</code></td><td>continue at an address</td></tr>
<tr><td><code>x</code></td><td>leave the monitor</td></tr>
</table>
<p>With "Load labels into the monitor" in the VICE settings, you can use your label names in the monitor.</p>
`));

  pages.push(p('sources', 'Sources & further reading', `
<h1>Sources and further reading</h1>
<p>The help pages and the editor's checks are based on these sources (all texts were written for this editor):</p>
<h2>Tools</h2>
<ul class="src-list">
<li>ACME crossassembler and its documentation (QuickRef, AllPOs, Errors, AddrModes, Illegals) - <a href="https://sourceforge.net/projects/acme-crossass/">sourceforge.net/projects/acme-crossass</a></li>
<li>C64-Wiki: ACME - <a href="https://www.c64-wiki.de/wiki/ACME">c64-wiki.de/wiki/ACME</a></li>
<li>C64-Wiki: Exomizer - <a href="https://www.c64-wiki.de/wiki/Exomizer">c64-wiki.de/wiki/Exomizer</a></li>
<li>Exomizer home page - <a href="https://bitbucket.org/magli143/exomizer/wiki/Home">bitbucket.org/magli143/exomizer</a></li>
<li>C64-Wiki: VICE - <a href="https://www.c64-wiki.de/wiki/VICE">c64-wiki.de/wiki/VICE</a></li>
<li>VICE manual (command line options) - <a href="https://vice-emu.sourceforge.io/">vice-emu.sourceforge.io</a></li>
<li>sidreloc by Linus Åkesson - <a href="https://www.linusakesson.net/software/sidreloc/index.php">linusakesson.net/software/sidreloc</a></li>
</ul>
<h2>Reference</h2>
<ul class="src-list">
<li>C64-Wiki: Übersicht 6502-Assemblerbefehle - <a href="https://www.c64-wiki.de/wiki/%C3%9Cbersicht_6502-Assemblerbefehle">c64-wiki.de</a></li>
<li>C64-Wiki: Speicherbelegungsplan - <a href="https://www.c64-wiki.de/wiki/Speicherbelegungsplan">c64-wiki.de</a></li>
<li>Memory Map (pagetable.com) - <a href="https://pagetable.com/c64ref/c64mem/">pagetable.com/c64ref/c64mem</a></li>
<li>C64 BASIC &amp; KERNAL ROM Disassembly (pagetable.com) - <a href="https://pagetable.com/c64ref/c64disasm/">pagetable.com/c64ref/c64disasm</a></li>
<li>C64 Character Set / PETSCII (pagetable.com) - <a href="https://pagetable.com/c64ref/charset/">pagetable.com/c64ref/charset</a></li>
<li>PSID file format (High Voltage SID Collection) - <a href="https://www.hvsc.c64.org/">hvsc.c64.org</a></li>
</ul>
<h2>More to learn</h2>
<ul class="src-list">
<li>Codebase64 - the C64 coding wiki, the source of ideas for the examples 11-20 - <a href="https://codebase64.net/doku.php?id=start">codebase64.net</a></li>
<li>C64-Wiki - <a href="https://www.c64-wiki.de/">c64-wiki.de</a></li>
</ul>
`));

  window.HelpContent = {
    groups: [
      { title: 'Getting started', ids: ['welcome', 'first-program', 'examples', 'shortcuts'] },
      { title: '6502 / 6510 CPU', ids: ['cpu', 'addrmodes', 'opcodes', 'illegal', 'opmatrix', 'numbers', 'branches', 'maths'] },
      { title: 'ACME assembler', ids: ['acme-intro', 'acme-po', 'acme-expr', 'acme-macros', 'acme-errors', 'acme-cli'] },
      { title: 'C64 hardware', ids: ['memmap', 'zeropage', 'vic', 'sprites', 'raster', 'sid', 'cia', 'colors', 'petscii', 'kernal'] },
      { title: 'Techniques', ids: ['scrolling', 'music', 'bitmap', 'speed', 'exomizer', 'vice'] },
      { title: 'About', ids: ['sources'] }
    ],
    pages,
    acmeHints: ACME_HINTS,
    tables: { KERNAL, VIC, SID, CIA, ZP, COLORS, ROUTINES }
  };

  function table(head, rows) {
    return `<table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="mono"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</table>`;
  }
})();
