/*
 * C64 ACME EDITOR - graphical memory map ($0000-$FFFF in $1000 steps)
 * (c) IT-Dummköpfe - MIT License
 */
/* global UI */
(function () {
  'use strict';

  // Named areas of the C64 memory (used for tooltips and column titles)
  const AREAS = [
    [0x0000, 0x0001, 'CPU port ($00/$01: memory banking)'],
    [0x0002, 0x00ff, 'Zero page (BASIC/KERNAL variables, free: $02, $fb-$fe)'],
    [0x0100, 0x01ff, 'Stack'],
    [0x0200, 0x0333, 'KERNAL/BASIC work area and vectors ($0314 = IRQ)'],
    [0x0334, 0x03ff, 'Cassette buffer (free RAM)'],
    [0x0400, 0x07e7, 'Screen RAM (default)'],
    [0x07e8, 0x07f7, 'unused'],
    [0x07f8, 0x07ff, 'Sprite pointers'],
    [0x0800, 0x9fff, 'BASIC program RAM ($0801 = start)'],
    [0xa000, 0xbfff, 'BASIC ROM (RAM underneath)'],
    [0xc000, 0xcfff, 'Free RAM'],
    [0xd000, 0xd3ff, 'VIC-II registers (char ROM / RAM underneath)'],
    [0xd400, 0xd7ff, 'SID registers'],
    [0xd800, 0xdbff, 'Colour RAM'],
    [0xdc00, 0xdcff, 'CIA 1 (keyboard, joystick, timers, IRQ)'],
    [0xdd00, 0xddff, 'CIA 2 (VIC bank, serial bus, NMI)'],
    [0xde00, 0xdfff, 'I/O 1 + I/O 2 (cartridges)'],
    [0xe000, 0xffff, 'KERNAL ROM (RAM underneath)']
  ];
  const COLUMNS = [
    ['ZP, stack, screen', 'sys'], ['BASIC RAM', 'ram'], ['BASIC RAM', 'ram'], ['BASIC RAM', 'ram'],
    ['BASIC RAM', 'ram'], ['BASIC RAM', 'ram'], ['BASIC RAM', 'ram'], ['BASIC RAM', 'ram'],
    ['BASIC RAM', 'ram'], ['BASIC RAM', 'ram'], ['BASIC ROM', 'rom'], ['BASIC ROM', 'rom'],
    ['Free RAM', 'ram'], ['I/O area', 'io'], ['KERNAL ROM', 'rom'], ['KERNAL ROM', 'rom']
  ];
  const KIND_NAMES = { code: 'Code', data: 'Data', bin: 'Binary include', sid: 'SID music', gfx: 'Graphics (.kla)' };

  function areaOf(addr) {
    for (const a of AREAS) if (addr >= a[0] && addr <= a[1]) return a[2];
    return '';
  }

  function classify(r, result) {
    if (r.tag === 'code') return 'code';
    if (r.tag === 'data') return 'data';
    if (r.tag === 'bin') {
      const b = (result.binaries || []).find(x => x.addr === r.start && (x.name.split(/[\\/]/).pop() === r.name));
      if (b && b.explicitSize) return 'bin';
      if (b && b.sid) return 'sid';
      if (b && b.kla) return 'gfx';
      if (/\.sid$/i.test(r.name)) return 'sid';
      if (/\.(kla|koa)$/i.test(r.name)) return 'gfx';
      return 'bin';
    }
    return 'data';
  }

  /**
   * render(container, result, { onJump(file, line) })
   */
  function render(container, result, opts) {
    opts = opts || {};
    container.innerHTML = '';
    const wrap = UI.el('div', { class: 'mm' });
    const ranges = (result && result.ranges) || [];
    const plain = result && (result.outputs || []).some(o => o.format === 'plain');

    // per byte usage counter (to find overlaps) and per page statistics
    const count = new Uint8Array(65536);
    const pages = Array.from({ length: 256 }, () => ({ used: 0, kinds: {}, items: [] }));
    const segs = ranges.map(r => Object.assign({}, r, { kind: classify(r, result) }));
    for (const r of segs) {
      const s = Math.max(0, r.start), e = Math.min(0x10000, r.end);
      for (let a = s; a < e; a++) { if (count[a] < 255) count[a]++; }
      for (let p = s >> 8; p <= (e - 1) >> 8 && p < 256; p++) {
        const lo = Math.max(s, p << 8), hi = Math.min(e, (p + 1) << 8);
        const pg = pages[p];
        pg.kinds[r.kind] = (pg.kinds[r.kind] || 0) + (hi - lo);
        pg.items.push(r);
      }
    }
    let totalUsed = 0, overlapBytes = 0;
    for (let a = 0; a < 65536; a++) {
      if (count[a]) totalUsed++;
      if (count[a] > 1) overlapBytes++;
      if (count[a]) pages[a >> 8].used++;
      if (count[a] > 1) pages[a >> 8].overlap = true;
    }

    const grid = UI.el('div', { class: 'mm-grid' });
    for (let c = 0; c < 16; c++) {
      const col = UI.el('div', { class: 'mm-col k-' + COLUMNS[c][1] });
      let colUsed = 0;
      const pg = UI.el('div', { class: 'mm-pages' });
      for (let p = c * 16; p < c * 16 + 16; p++) {
        const info = pages[p];
        colUsed += info.used;
        const cell = UI.el('div', { class: 'mm-page' + (info.overlap ? ' overlap' : '') });
        if (info.used) {
          const kinds = Object.keys(info.kinds).sort((a, b) => info.kinds[b] - info.kinds[a]);
          const fill = UI.el('i', { class: 'k-' + kinds[0] });
          fill.style.height = Math.max(12, Math.round(info.used / 256 * 100)) + '%';
          cell.appendChild(fill);
        }
        cell.addEventListener('mousemove', (e) => {
          const a = p << 8;
          let html = `<b>${UI.hex(a, 4)}-${UI.hex(a + 255, 4)}</b><br><span class="muted">${UI.esc(areaOf(a))}</span>`;
          if (info.used) {
            html += `<br>${info.used} of 256 bytes used`;
            const seen = new Set();
            for (const it of info.items) {
              const k = it.start + '|' + it.end + '|' + it.kind;
              if (seen.has(k)) continue; seen.add(k);
              html += `<br>${KIND_NAMES[it.kind]}${it.name ? ' "' + UI.esc(it.name) + '"' : ''} ${UI.hex(it.start, 4)}-${UI.hex(it.end - 1, 4)} <span class="muted">(line ${it.line + 1}${it.file && it.file !== result.mainPath ? ', ' + UI.esc(String(it.file).split(/[\\/]/).pop()) : ''})</span>`;
            }
          } else html += '<br><span class="muted">free</span>';
          if (info.overlap) html += '<br><span class="tt-err">Overlap: two segments use the same bytes!</span>';
          UI.showTip(html, e.clientX, e.clientY);
        });
        cell.addEventListener('mouseleave', UI.hideTip);
        cell.addEventListener('click', () => { if (info.items.length && opts.onJump) opts.onJump(info.items[0].file, info.items[0].line); });
        pg.appendChild(cell);
      }
      col.append(
        UI.el('div', { class: 'mm-addr', text: UI.hex(c << 12, 4) }),
        UI.el('div', { class: 'mm-name', text: COLUMNS[c][0], title: COLUMNS[c][0] }),
        pg,
        UI.el('div', { class: 'mm-use', text: colUsed ? (colUsed >= 1024 ? (colUsed / 1024).toFixed(1) + ' KB' : colUsed + ' B') : '' })
      );
      grid.appendChild(col);
    }
    wrap.appendChild(grid);

    // legend + summary
    const legend = UI.el('div', { class: 'mm-legend' });
    for (const k of ['code', 'data', 'sid', 'gfx', 'bin']) legend.appendChild(UI.el('span', null, UI.el('span', { class: 'sw k-' + k }), KIND_NAMES[k]));
    legend.appendChild(UI.el('span', null, UI.el('span', { class: 'sw rom' }), 'ROM area'));
    legend.appendChild(UI.el('span', null, UI.el('span', { class: 'sw io' }), 'I/O area'));
    const merged = mergeRanges(segs);
    let summary;
    if (!segs.length) summary = 'No bytes yet - start with "* = $0801".';
    else {
      summary = `${totalUsed} bytes used in ${merged.length} block${merged.length === 1 ? '' : 's'}, ${UI.hex(merged[0].start, 4)}-${UI.hex(merged[merged.length - 1].end - 1, 4)}`;
      if (overlapBytes) summary += ` - ${overlapBytes} bytes overlap!`;
      if (plain) summary += ' (output format "plain": addresses are file offsets)';
    }
    legend.appendChild(UI.el('span', { class: 'tb-spacer' }));
    legend.appendChild(UI.el('span', { class: 'mm-summary', text: summary }));
    wrap.appendChild(legend);

    // list of segments
    const list = UI.el('div', { class: 'mm-segs' });
    const groups = [];
    for (const s of segs.slice().sort((a, b) => a.start - b.start)) {
      const g = groups[groups.length - 1];
      if (g && g.kind === s.kind && g.end === s.start && g.name === s.name) g.end = s.end;
      else groups.push(Object.assign({}, s));
    }
    for (const g of groups.slice(0, 60)) {
      let label = `${UI.hex(g.start, 4)}-${UI.hex(g.end - 1, 4)} ${KIND_NAMES[g.kind]}${g.name ? ' ' + g.name : ''} (${g.end - g.start} B)`;
      if (g.kind === 'sid') {
        const b = (result.binaries || []).find(x => x.addr === g.start && x.sid);
        if (b && b.sid.name) label += ' - ' + b.sid.name;
      }
      const chip = UI.el('button', { class: 'mm-seg', title: 'Go to line ' + (g.line + 1) }, UI.el('span', { class: 'sw k-' + g.kind }), label);
      chip.addEventListener('click', () => opts.onJump && opts.onJump(g.file, g.line));
      list.appendChild(chip);
    }
    wrap.appendChild(list);
    container.appendChild(wrap);
    return { used: totalUsed, overlap: overlapBytes, blocks: merged };
  }

  function mergeRanges(list) {
    const s = list.map(r => ({ start: r.start, end: r.end })).sort((a, b) => a.start - b.start);
    const out = [];
    for (const r of s) {
      const l = out[out.length - 1];
      if (l && r.start <= l.end) l.end = Math.max(l.end, r.end); else out.push(r);
    }
    return out;
  }

  window.MemMap = { render, areaOf, AREAS };
})();
