/*
 * C64 ACME EDITOR - number converter (HEX / DEC / BIN + ACME expressions)
 * (c) IT-Dummköpfe - MIT License
 */
/* global UI, C64Asm, MemMap, App */
(function () {
  'use strict';
  const COLOR_NAMES = ['black', 'white', 'red', 'cyan', 'purple', 'green', 'blue', 'yellow', 'orange', 'brown', 'light red', 'dark grey', 'grey', 'light green', 'light blue', 'light grey'];
  const SCREEN_CHARS = '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[£]↑← !"#$%&\'()*+,-./0123456789:;<=>?';

  let root, ctx, value = 0, bits = 8;
  const f = {};

  function init(container, context) {
    root = container; ctx = context;
    const close = UI.el('button', { class: 'icon-btn', title: 'Close (Ctrl+K)', text: 'Close' });
    close.addEventListener('click', toggle);
    f.expr = UI.el('input', { type: 'text', placeholder: 'e.g. $d000 + 32 * 2 or a label' });
    f.hex = UI.el('input', { type: 'text', spellcheck: 'false' });
    f.dec = UI.el('input', { type: 'text', spellcheck: 'false' });
    f.bin = UI.el('input', { type: 'text', spellcheck: 'false' });
    f.err = UI.el('div', { class: 'conv-note', style: 'color:var(--err);min-height:16px' });
    f.bits = UI.el('div', { class: 'conv-bits' });
    f.width = UI.el('select', null, UI.el('option', { value: '8', text: '8 bit' }), UI.el('option', { value: '16', text: '16 bit' }));
    f.table = UI.el('table', { class: 'conv-table' });
    const ins = UI.el('div', { class: 'conv-insert' });
    for (const [label, fmt] of [['Insert $hex', 'hex'], ['Insert dec', 'dec'], ['Insert %bin', 'bin']]) {
      const b = UI.el('button', { class: 'btn small', text: label });
      b.addEventListener('click', () => ctx.insert(format(fmt)));
      ins.appendChild(b);
    }
    const field = (label, input) => UI.el('div', { class: 'conv-field' }, UI.el('label', { text: label }), input);
    root.append(
      UI.el('h2', null, UI.el('span', { text: 'Number converter' }), close),
      field('Expr', f.expr),
      f.err,
      field('HEX', f.hex), field('DEC', f.dec), field('BIN', f.bin),
      UI.el('div', { class: 'conv-field' }, UI.el('label', { text: 'Width' }), f.width),
      f.bits,
      ins,
      f.table,
      UI.el('p', { class: 'conv-note', text: 'Type in any field. "Expr" understands ACME syntax: $hex, %binary, &octal, labels of your program, + - * / < > and more. Click the bits to toggle them.' })
    );
    f.expr.addEventListener('input', () => {
      const r = C64Asm.evaluate(f.expr.value, ctx.getSymbols(), ctx.getPc());
      if (!f.expr.value.trim()) { f.err.textContent = ''; return; }
      if (r.ok) { f.err.textContent = r.float ? 'Float result ' + r.value + ' - shown as integer' : ''; set(Math.trunc(r.value), f.expr); }
      else f.err.textContent = r.error;
    });
    f.hex.addEventListener('input', () => { const v = parseInt(f.hex.value.replace(/^\$|^0x/i, ''), 16); if (!isNaN(v)) set(v, f.hex); });
    f.dec.addEventListener('input', () => { const v = parseInt(f.dec.value, 10); if (!isNaN(v)) set(v, f.dec); });
    f.bin.addEventListener('input', () => { const v = parseInt(f.bin.value.replace(/^%|^0b/i, '').replace(/\./g, '0').replace(/#/g, '1').replace(/\s/g, ''), 2); if (!isNaN(v)) set(v, f.bin); });
    f.width.addEventListener('change', () => { bits = parseInt(f.width.value, 10); set(value, null); });
    set(0, null);
  }

  function format(kind) {
    if (kind === 'hex') return '$' + value.toString(16).padStart(value > 255 ? 4 : 2, '0');
    if (kind === 'bin') return '%' + value.toString(2).padStart(bits, '0');
    return String(value);
  }

  function set(v, from) {
    if (v < 0) v = (v + (v < -128 ? 0x10000 : 0x100)) & (v < -128 ? 0xffff : 0xff);
    v = v & 0xffffffff;
    if (v > 255 && bits === 8) { bits = 16; f.width.value = '16'; }
    if (v > 0xffff) v &= 0xffff;
    value = v;
    if (from !== f.hex) f.hex.value = '$' + v.toString(16).padStart(bits === 16 ? 4 : 2, '0');
    if (from !== f.dec) f.dec.value = String(v);
    if (from !== f.bin) f.bin.value = '%' + v.toString(2).padStart(bits, '0');
    // bit buttons
    f.bits.innerHTML = '';
    f.bits.style.gridTemplateColumns = 'repeat(8, 1fr)';
    for (let b = bits - 1; b >= 0; b--) {
      const cell = UI.el('div');
      const btn = UI.el('button', { class: (v >> b) & 1 ? 'on' : '', text: String((v >> b) & 1), title: `bit ${b} = ${1 << b}` });
      btn.addEventListener('click', () => set(value ^ (1 << b), null));
      cell.append(btn, UI.el('div', { class: 'bitno', text: String(b) }));
      f.bits.appendChild(cell);
    }
    // extra information
    const rows = [];
    const signed = bits === 8 ? (v & 0x80 ? v - 256 : v) : (v & 0x8000 ? v - 65536 : v);
    rows.push(['Signed', String(signed)]);
    if (bits === 16 || v > 255) rows.push(['Low / high', `$${(v & 255).toString(16).padStart(2, '0')} / $${((v >> 8) & 255).toString(16).padStart(2, '0')}`]);
    rows.push(['Octal', '&' + v.toString(8)]);
    if (v < 16) rows.push(['C64 colour', COLOR_NAMES[v]]);
    if (v < 256) {
      const sc = v & 127;
      rows.push(['Screen code', (sc < 64 ? SCREEN_CHARS[sc] : 'graphics') + (v > 127 ? ' (reversed)' : '')]);
      const pet = v >= 32 && v < 127 ? String.fromCharCode(v >= 65 && v <= 90 ? v + 32 : v >= 97 && v <= 122 ? v - 32 : v) : petControl(v);
      rows.push(['PETSCII', pet]);
    }
    if (v <= 0xffff) {
      const info = window.App && App.addrInfo && App.addrInfo.get(v);
      rows.push(['Memory', info ? info.name : MemMap.areaOf(v)]);
    }
    if (v < 256) rows.push(['Sprite pointer', `data at $${(v * 64).toString(16).padStart(4, '0')} (bank 0)`]);
    f.table.innerHTML = '';
    for (const [k, val] of rows) f.table.appendChild(UI.el('tr', null, UI.el('td', { text: k }), UI.el('td', { text: val })));
  }

  function petControl(v) {
    const map = { 5: 'white', 13: 'RETURN', 14: 'lower case', 17: 'cursor down', 18: 'RVS on', 19: 'HOME', 20: 'DEL', 28: 'red', 29: 'cursor right', 30: 'green', 31: 'blue', 129: 'orange', 142: 'upper case', 144: 'black', 145: 'cursor up', 146: 'RVS off', 147: 'CLR (clear screen)', 149: 'brown', 150: 'light red', 151: 'dark grey', 152: 'grey', 153: 'light green', 154: 'light blue', 155: 'light grey', 156: 'purple', 157: 'cursor left', 158: 'yellow', 159: 'cyan' };
    return map[v] ? 'control: ' + map[v] : (v >= 192 && v <= 223 ? 'shifted letter / graphics' : (v >= 160 ? 'graphics' : '-'));
  }

  function toggle(force) {
    const show = typeof force === 'boolean' ? force : root.classList.contains('hidden');
    root.classList.toggle('hidden', !show);
    if (show) setTimeout(() => f.expr.focus(), 20);
    if (ctx && ctx.onToggle) ctx.onToggle(show);
  }

  window.Converter = { init, toggle, setValue: (v) => { set(v, null); }, setExpression: (s) => { f.expr.value = s; f.expr.dispatchEvent(new Event('input')); } };
})();
