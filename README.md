# C64 ACME EDITOR 0.1b

An editor for writing Commodore 64 machine language with the **ACME** cross
assembler - with live checking, a memory map, the **VICE** emulator, the
**Exomizer** packer, the **sidreloc** SID relocator and a help center to learn
6502 assembler.

by **IT-Dummköpfe** - MIT license

---

## Features

- **Live checking while you type.** Every line is assembled by a built-in ACME
  model: unknown mnemonics, wrong addressing modes (`sta #4`), values out of
  range, branches that are too far, undefined labels, wrong pseudo opcodes,
  unclosed blocks, code from other assemblers (`.byte`, `org` ...). The error
  is underlined, and the line below the editor says **what is wrong and how to
  fix it**. About one second after you stop typing, the real ACME confirms the
  result in the background.
- **Sanity check** (Shift+F7): finds things that assemble fine but will not
  work on a C64 - a SYS line that points to the wrong address, a SID tune
  placed at the wrong address or with the wrong header skip, a raster IRQ that
  is never acknowledged, code under the BASIC/KERNAL ROM or in the I/O area,
  overlapping segments, unreachable code, SED without CLD, unbalanced stack
  and more.
- **Memory map** in $1000 steps with named areas (zero page, screen, BASIC
  RAM, BASIC ROM, I/O, KERNAL ROM ...). It updates while you type and also
  shows included files such as SID music and pictures. Hover a page for
  details, click it to jump to the source line.
- **Syntax highlighting** for ACME, monospaced font (JetBrains Mono), **day
  and night mode**.
- **Editor functions:** tabs, find / replace (with regular expressions), go to
  line, upper/lower case for the selection or for all mnemonics, comment
  toggle, duplicate/move lines, tidy columns, auto completion, code folding of
  `{ }` blocks, templates (BASIC start line, raster IRQ, SID include, sprite
  data, macros).
- **Hover information:** numbers in hex/dec/bin, the meaning of C64 registers
  (`$d020` = border colour), label values, instruction cycles and opcodes.
- **Number converter** (Ctrl+K) for HEX / DEC / BIN with bit switches. It
  also evaluates ACME expressions with the labels of your program.
- **Build & run** (F5): assemble with ACME and start the program in VICE.
  All VICE options (C64 model, SID chip, borders, joysticks, warp, true drive,
  extra arguments ...) are in the settings.
- **Save as PRG** with the question whether to pack it with **Exomizer**
  (start address and decrunch effect selectable).
- **Relocate SID** tunes to another address with **sidreloc**, show SID
  header information and insert a matching `!bin` include.
- **Help center** (F1): 6502 instruction set with opcodes and cycles, illegal
  opcodes, opcode matrix, addressing modes, ACME pseudo opcodes and
  expressions, ACME error messages, C64 memory map, VIC-II / SID / CIA
  registers, KERNAL routines, PETSCII and screen codes, colours, raster
  interrupts, sprites, scrolling, SID music, bitmaps, speed tricks, Exomizer
  and VICE. Ctrl+F1 opens the page for the word at the cursor.
- **Examples**, all fully commented:
  Hello World - Raster Bars (border + background) - Soft Scroller - Sprite
  Animation - Sprite Scroller - Simple Plasma - Complex Plasma - Rotating 3D
  Square - SID Player 1x/2x/3x with text - Koala Picture Viewer (.kla) - and
  the source of the included demo tune.

## Download

Ready-to-use builds are created by GitHub Actions for every release:
**Releases** page of this repository.

| System | File | Included tools |
|---|---|---|
| Windows 10/11 (x64) | `C64-ACME-EDITOR-0.1b-Windows-Setup.exe` or `...-win-x64.zip` (portable) | ACME, Exomizer, sidreloc, VICE |
| macOS (Apple Silicon) | `C64-ACME-EDITOR-0.1b-macOS-AppleSilicon.dmg` | ACME, Exomizer, sidreloc, VICE |
| Linux (x64) | `.AppImage` or `.deb` | ACME, Exomizer, sidreloc - VICE from your system |

### First start notes

- **macOS:** the app is not notarized by Apple. If macOS says it "cannot be
  opened", open *System Settings > Privacy & Security* and click
  *Open anyway*, or run once in the Terminal:
  `xattr -dr com.apple.quarantine "/Applications/C64 ACME EDITOR.app"`
- **Windows:** SmartScreen may warn about an unknown publisher -
  *More info > Run anyway*.
- **Linux:** there is no official VICE binary for Linux. Install it with your
  package manager (e.g. `sudo apt install vice`) or as Flatpak
  (`flatpak install flathub net.sf.VICE`). The editor finds `x64sc`
  automatically; otherwise set the path (or a command like
  `flatpak run net.sf.VICE`) in *Settings > Tools*.

## Using the editor

1. *Examples > Hello World* (or the example gallery, Ctrl+Shift+E).
2. Press **F5** - the program runs in VICE.
3. Change something. Mistakes are underlined immediately; the bar below the
   editor explains the fix. **Ctrl+J** shows all problems.
4. **Shift+F7** runs the sanity check, **Ctrl+Shift+P** saves a PRG (optionally
   packed with Exomizer).

Important shortcuts: F5 run, Shift+F5 pack & run, F7 check with ACME,
Ctrl+B build PRG next to the source, Ctrl+K number converter, Ctrl+M memory
map, Ctrl+T day/night, F1 help. The complete list is in *Help > Keyboard
Shortcuts*.

## Building from source

Requirements: Node.js 20+, a C compiler (gcc/clang; MSYS2 MinGW64 on Windows).

```bash
npm install
bash scripts/fetch-sources.sh tool-src            # ACME, Exomizer, sidreloc sources
bash scripts/build-tools.sh linux tool-src        # or: mac / win  -> vendor/tools
bash scripts/fetch-vice.sh mac                    # Windows / macOS: download VICE
npm start                                         # run the editor
npm run dist                                      # create installers in dist/
```

Tests (the built-in assembler model is compared with the real ACME on all
examples, plus error detection and sanity check cases):

```bash
ACME=vendor/tools/acme node test/run-tests.js
```

`test/c64.js` contains a small C64 model (6502 + VIC-II/CIA basics, uses the
original ROMs from VICE) that was used to run all examples and check their
output.

## Project structure

```
src/main/          Electron main process (menus, files, tools, settings)
src/renderer/      user interface
  js/assembler.js  ACME-compatible source model (live checks, memory layout)
  js/analyzer.js   sanity check
  js/opcodes.js    6502/6510 instruction set data
  js/help-*.js     help center
examples/          example programs, demo tune and demo picture
scripts/           download/build scripts for ACME, Exomizer, sidreloc, VICE
.github/workflows  builds for Windows, macOS (Apple Silicon) and Linux
```

## Sources

- ACME: https://www.c64-wiki.de/wiki/ACME - https://sourceforge.net/projects/acme-crossass/
- Exomizer: https://www.c64-wiki.de/wiki/Exomizer - https://bitbucket.org/magli143/exomizer/wiki/Home
- VICE: https://www.c64-wiki.de/wiki/VICE - https://vice-emu.sourceforge.io/
- sidreloc: https://www.linusakesson.net/software/sidreloc/index.php
- 6502 instructions: https://www.c64-wiki.de/wiki/%C3%9Cbersicht_6502-Assemblerbefehle
- Memory map: https://www.c64-wiki.de/wiki/Speicherbelegungsplan - https://pagetable.com/c64ref/c64mem/
- BASIC & KERNAL ROM disassembly: https://pagetable.com/c64ref/c64disasm/
- Character set / PETSCII: https://pagetable.com/c64ref/charset/

Third party licenses: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
