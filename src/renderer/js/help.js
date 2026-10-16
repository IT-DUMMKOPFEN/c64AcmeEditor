/*
 * C64 ACME EDITOR - help center (navigation, search, generated reference pages)
 * (c) IT-Dummköpfe - MIT License
 */
/* global UI, HelpContent, C64Opcodes */
(function () {
  'use strict';
  const O = C64Opcodes;
  const MODE_ORDER = ['imp', 'acc', 'imm', 'zp', 'zpx', 'zpy', 'abs', 'abx', 'aby', 'ind', 'izx', 'izy', 'rel'];
  const FLAG_NAMES = { N: 'Negative', V: 'Overflow', B: 'Break', D: 'Decimal', I: 'Interrupt', Z: 'Zero', C: 'Carry' };
  let root, nav, content, search, current = null, history = [];

  function byId(id) {
    if (id.startsWith('op-')) return { id, title: id.slice(3).toUpperCase(), gen: 'op' };
    if (id.startsWith('po-')) return { id, title: '!' + id.slice(3), gen: 'po' };
    return HelpContent.pages.find(p => p.id === id);
  }

  // ------------------------------------------------------------ generators
  function genOpcodes() {
    const groups = {};
    for (const mn of O.mnemonicList()) { const g = O.LEGAL[mn].group; (groups[g] = groups[g] || []).push(mn); }
    let html = '<h1>6502 instruction set</h1><p>The 56 official instructions of the 6502/6510. Click one for details, addressing modes, opcodes and cycles. The orange ones further down are the undocumented ("illegal") opcodes, available in ACME with <code>!cpu 6510</code>.</p>';
    html += '<div class="op-grid">' + O.mnemonicList().map(m => `<a data-page="op-${m.toLowerCase()}" title="${UI.esc(O.LEGAL[m].title)}">${m}</a>`).join('') + '</div>';
    html += '<h2>By group</h2><table><tr><th>Group</th><th>Instructions</th></tr>';
    for (const g of Object.keys(groups)) html += `<tr><td>${g}</td><td>${groups[g].map(m => `<a data-page="op-${m.toLowerCase()}">${m}</a>`).join(' ')}</td></tr>`;
    html += '</table><h2>All instructions</h2><table><tr><th>Mnemonic</th><th>Name</th><th>Flags</th><th>Modes</th></tr>';
    for (const m of O.mnemonicList()) {
      const d = O.LEGAL[m];
      html += `<tr><td><a data-page="op-${m.toLowerCase()}">${m}</a></td><td>${UI.esc(d.title)}</td><td class="mono">${d.flags || '-'}</td><td>${MODE_ORDER.filter(k => d.modes[k]).map(k => O.MODES[k].name).join(', ')}</td></tr>`;
    }
    html += '</table><div class="op-grid">' + O.illegalList().map(m => `<a class="illegal" data-page="op-${m.toLowerCase()}">${m}</a>`).join('') + '</div>';
    return html;
  }

  function genOp(id) {
    const mn = id.slice(3).toUpperCase();
    const d = O.ALL[mn];
    if (!d) return '<h1>Unknown instruction</h1>';
    let html = `<h1>${mn} - ${UI.esc(d.title)}</h1>`;
    if (d.illegal) html += `<p class="note">Undocumented opcode${d.aka ? ' (also known as ' + UI.esc(d.aka) + ')' : ''}. In ACME only available after <code>!cpu 6510</code>.</p>`;
    html += `<p>${UI.esc(d.desc)}</p>`;
    html += '<h2>Flags</h2><p>';
    html += 'NVBDIZC'.split('').map(f => `<code style="${(d.flags || '').includes(f) ? 'background:var(--accent);color:var(--accent-fg)' : 'opacity:.45'}" title="${FLAG_NAMES[f]}">${f}</code>`).join(' ');
    html += d.flags ? ` &nbsp; changes: ${d.flags.split('').map(f => FLAG_NAMES[f]).join(', ')}</p>` : ' &nbsp; no flags changed</p>';
    html += '<h2>Addressing modes</h2><table><tr><th>Mode</th><th>ACME syntax</th><th>Opcode</th><th>Bytes</th><th>Cycles</th></tr>';
    for (const k of MODE_ORDER) {
      const m = d.modes[k]; if (!m) continue;
      const syn = (k === 'imp' || k === 'acc') ? mn.toLowerCase() : k === 'rel' ? mn.toLowerCase() + ' label' : mn.toLowerCase() + ' ' + O.MODES[k].syntax;
      const extra = m[2] === 'p' ? ' (+1 if a page is crossed)' : m[2] === 'b' ? ' (+1 if taken, +2 across a page)' : '';
      html += `<tr><td>${O.MODES[k].name}</td><td class="mono">${UI.esc(syn)}</td><td class="mono">$${m[0].toString(16).padStart(2, '0').toUpperCase()}</td><td>${O.MODES[k].bytes}</td><td>${m[1]}${extra}</td></tr>`;
    }
    html += '</table>';
    if (d.example) html += `<h2>Example</h2><pre>${UI.esc(d.example.split('\n').map(l => '        ' + l).join('\n'))}</pre>`;
    const related = Object.keys(O.ALL).filter(k => k !== mn && O.ALL[k].group === d.group).slice(0, 14);
    if (related.length) html += `<h2>Related</h2><p>${related.map(k => `<a data-page="op-${k.toLowerCase()}">${k}</a>`).join(' ')}</p>`;
    return html;
  }

  function genIllegal() {
    let html = '<h1>Illegal (undocumented) opcodes</h1><p>The NMOS 6510 in the C64 executes many of the 105 "unused" opcodes in a predictable way. Demo coders use them to save cycles. In ACME they are enabled with <code>!cpu 6510</code>. The names follow ACME; other assemblers use other names (shown in brackets).</p>';
    html += '<table><tr><th>Mnemonic</th><th>Does</th><th>Modes</th><th>Notes</th></tr>';
    for (const m of O.illegalList()) {
      const d = O.ILLEGAL[m];
      html += `<tr><td><a data-page="op-${m.toLowerCase()}">${m}</a>${d.aka ? ' <span style="color:var(--muted)">(' + UI.esc(d.aka) + ')</span>' : ''}</td><td>${UI.esc(d.title)}</td><td>${MODE_ORDER.filter(k => d.modes[k]).map(k => O.MODES[k].name).join(', ')}</td><td>${UI.esc(d.desc)}</td></tr>`;
    }
    return html + '</table><p>Unstable opcodes (ANE, LXA, SHA, SHX, SHY, TAS) may behave differently between chips - avoid them unless you know exactly why you need them.</p>';
  }

  function genMatrix() {
    let html = '<h1>Opcode matrix</h1><p>All 256 opcode bytes: row = high nibble, column = low nibble. Orange = illegal opcode. Useful when you read a hex dump or write self-modifying code.</p><table class="opmatrix"><tr><th></th>';
    for (let c = 0; c < 16; c++) html += `<th>x${c.toString(16).toUpperCase()}</th>`;
    html += '</tr>';
    const short = { imp: '', acc: 'A', imm: '#', zp: 'zp', zpx: 'zp,x', zpy: 'zp,y', abs: 'abs', abx: 'abs,x', aby: 'abs,y', ind: '(ind)', izx: '(zp,x)', izy: '(zp),y', rel: 'rel' };
    for (let r = 0; r < 16; r++) {
      html += `<tr><th>${r.toString(16).toUpperCase()}x</th>`;
      for (let c = 0; c < 16; c++) {
        const e = O.BY_OPCODE[r * 16 + c];
        if (!e) html += '<td class="none">-</td>';
        else html += `<td class="${e.illegal ? 'ill' : ''}" title="$${(r * 16 + c).toString(16).padStart(2, '0')}: ${e.mnemonic} ${O.MODES[e.mode].name}, ${e.cycles} cycles"><a data-page="op-${e.mnemonic.toLowerCase()}">${e.mnemonic}</a><br>${short[e.mode]}</td>`;
      }
      html += '</tr>';
    }
    return html + '</table>';
  }

  function genPseudo() {
    let html = '<h1>ACME pseudo opcodes</h1><p>Pseudo opcodes are commands for the assembler. They start with "!" and are not case sensitive. Aliases are shown in brackets.</p>';
    const aliases = {};
    for (const [k, v] of Object.entries(O.PSEUDO)) if (v.aliasOf) (aliases[v.aliasOf] = aliases[v.aliasOf] || []).push(k);
    html += '<table><tr><th>Pseudo opcode</th><th>Arguments</th><th>Description</th></tr>';
    for (const [k, v] of Object.entries(O.PSEUDO)) {
      if (v.aliasOf) continue;
      html += `<tr><td class="mono"><b>${k}</b>${aliases[k] ? '<br><span style="color:var(--muted)">' + aliases[k].join(' ') + '</span>' : ''}</td><td class="mono">${UI.esc(v.args)}</td><td>${UI.esc(v.desc)}${v.example ? '<pre>' + UI.esc(v.example) + '</pre>' : ''}</td></tr>`;
    }
    return html + '</table>';
  }

  function genErrors() {
    let html = '<h1>ACME error messages</h1><p>The most common messages from ACME, what they mean and how to fix them. The editor shows these explanations directly below the source when ACME reports such a problem.</p><table><tr><th>Message</th><th>Meaning</th><th>Fix</th></tr>';
    for (const [re, meaning, fix] of HelpContent.acmeHints) {
      html += `<tr><td class="mono">${UI.esc(String(re).replace(/^\/|\/i$/g, '').replace(/\\/g, '').replace(/\(([^)]*)\|([^)]*)\)/, '$1/$2'))}</td><td>${UI.esc(meaning)}</td><td>${UI.esc(fix)}</td></tr>`;
    }
    return html + '</table>';
  }

  function genPetscii(page) {
    let html = '<h1>PETSCII and screen codes</h1><p>The C64 uses two different character codes: <b>PETSCII</b> for printing with CHROUT ($FFD2) and in BASIC, and <b>screen codes</b> for writing directly into screen RAM ($0400). In ACME, <code>!pet</code> creates PETSCII and <code>!scr</code> creates screen codes from normal text.</p>';
    html += '<h2>PETSCII control codes</h2><table><tr><th>Dec</th><th>Hex</th><th>Function</th></tr>';
    for (const [c, n] of page.ctrl) html += `<tr><td>${c}</td><td class="mono">$${c.toString(16).toUpperCase().padStart(2, '0')}</td><td>${n}</td></tr>`;
    html += '</table><h2>Screen codes 0-63 (upper case / graphics set)</h2><table><tr><th>Code</th><th>Char</th><th>Code</th><th>Char</th><th>Code</th><th>Char</th><th>Code</th><th>Char</th></tr>';
    const chars = '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[£]↑← !"#$%&\'()*+,-./0123456789:;<=>?';
    for (let r = 0; r < 16; r++) {
      html += '<tr>';
      for (let c = 0; c < 4; c++) { const code = c * 16 + r; html += `<td class="mono">${code} / $${code.toString(16).padStart(2, '0')}</td><td class="mono"><b>${UI.esc(chars[code])}</b></td>`; }
      html += '</tr>';
    }
    html += '</table><p>Codes 64-127 are graphics characters (or upper case letters in the lower case set). Codes 128-255 are the same characters in reverse. Add 128 to a screen code to invert a character.</p>';
    html += '<h2>Converting PETSCII to screen codes</h2><table><tr><th>PETSCII</th><th>Screen code</th></tr><tr><td>$20-$3F</td><td>same ($20-$3F)</td></tr><tr><td>$40-$5F</td><td>minus $40 ($00-$1F)</td></tr><tr><td>$60-$7F</td><td>minus $20 ($40-$5F)</td></tr><tr><td>$A0-$BF</td><td>minus $40 ($60-$7F)</td></tr><tr><td>$C0-$FE</td><td>minus $80 ($40-$7E)</td></tr></table>';
    return html;
  }

  function genPo(id) {
    const name = '!' + id.slice(3);
    const canon = O.canonicalPseudo(name);
    const d = canon ? O.PSEUDO[canon] : null;
    if (!d) return '<h1>Unknown pseudo opcode</h1>';
    return `<h1>${canon}</h1><p class="mono">${UI.esc(canon + ' ' + d.args)}</p><p>${UI.esc(d.desc)}</p>${d.example ? '<h2>Example</h2><pre>' + UI.esc(d.example) + '</pre>' : ''}<p><a data-page="acme-po">All pseudo opcodes</a></p>`;
  }

  function pageHtml(page) {
    switch (page.gen) {
      case 'opcodes': return genOpcodes();
      case 'op': return genOp(page.id);
      case 'po': return genPo(page.id);
      case 'illegal': return genIllegal();
      case 'opmatrix': return genMatrix();
      case 'pseudo': return genPseudo();
      case 'acme-errors': return genErrors();
      case 'petscii': return genPetscii(page);
      default: return page.html;
    }
  }

  // ------------------------------------------------------------- UI
  function build() {
    root = document.getElementById('helpRoot');
    const back = UI.el('button', { class: 'btn small', text: 'Back' });
    back.addEventListener('click', () => { history.pop(); const prev = history.pop(); if (prev) show(prev); });
    const close = UI.el('button', { class: 'btn small', text: 'Close help (Esc)' });
    close.addEventListener('click', hide);
    search = UI.el('input', { type: 'text', placeholder: 'Search help: lda, sprite, $d018, raster ...' });
    search.addEventListener('input', renderNav);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const first = nav.querySelector('a'); if (first) first.click(); }
    });
    nav = UI.el('nav', { class: 'help-nav' });
    content = UI.el('div', { class: 'help-content' });
    content.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      if (a.dataset.page) { e.preventDefault(); show(a.dataset.page); }
      else if (/^https?:/.test(a.getAttribute('href') || '')) { e.preventDefault(); window.api.openExternal(a.getAttribute('href')); }
    });
    root.append(
      UI.el('div', { class: 'help-top' }, UI.el('div', { class: 'brand' }, UI.el('span', { class: 'stripes', html: '<i></i><i></i><i></i><i></i><i></i>' }), UI.el('span', { class: 'brand-name', text: 'Help center' })), search, UI.el('span', { class: 'tb-spacer' }), back, close),
      UI.el('div', { class: 'help-body' }, nav, content)
    );
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
    renderNav();
  }

  function textOf(page) {
    if (!page.__text) {
      const div = document.createElement('div');
      div.innerHTML = pageHtml(page);
      page.__text = (page.title + ' ' + div.textContent).toLowerCase();
    }
    return page.__text;
  }

  function renderNav() {
    const q = (search.value || '').trim().toLowerCase();
    nav.innerHTML = '';
    if (q) {
      const hits = [];
      const mn = q.replace(/^[^a-z]*/, '').toUpperCase();
      if (O.ALL[mn]) hits.push({ id: 'op-' + mn.toLowerCase(), title: mn + ' - ' + O.ALL[mn].title });
      if (q.startsWith('!') && O.canonicalPseudo(q)) hits.push({ id: 'po-' + O.canonicalPseudo(q).slice(1), title: O.canonicalPseudo(q) });
      for (const p of HelpContent.pages) if (textOf(p).includes(q)) hits.push(p);
      nav.appendChild(UI.el('div', { class: 'grp', text: hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : 'Nothing found' }));
      for (const h of hits) nav.appendChild(navLink(h.id, h.title));
      return;
    }
    for (const g of HelpContent.groups) {
      nav.appendChild(UI.el('div', { class: 'grp', text: g.title }));
      for (const id of g.ids) { const p = byId(id); if (p) nav.appendChild(navLink(id, p.title)); }
    }
  }

  function navLink(id, title) {
    const a = UI.el('a', { class: current === id ? 'active' : '', text: title, tabindex: '0' });
    a.addEventListener('click', () => show(id));
    a.addEventListener('keydown', (e) => { if (e.key === 'Enter') show(id); });
    return a;
  }

  function show(id) {
    if (!root) build();
    const page = byId(id) || byId('welcome');
    current = page.id;
    history.push(page.id);
    root.classList.remove('hidden');
    content.innerHTML = '<article>' + pageHtml(page) + '</article>';
    content.scrollTop = 0;
    for (const a of nav.querySelectorAll('a')) a.classList.toggle('active', a.textContent === page.title);
    if (!search.value) renderNav();
  }

  function hide() { if (root) root.classList.add('hidden'); if (window.App) window.App.focusEditor(); }
  function isOpen() { return root && !root.classList.contains('hidden'); }

  // context help for a word (mnemonic, pseudo op, register address)
  function forWord(word) {
    if (!word) return show('welcome');
    const w = word.trim();
    if (O.ALL[w.toUpperCase()]) return show('op-' + w.toLowerCase());
    if (w.startsWith('!') && O.canonicalPseudo(w)) return show('po-' + O.canonicalPseudo(w).slice(1));
    const v = UI.parseNum(w);
    if (!isNaN(v)) {
      if (v >= 0xd000 && v <= 0xd3ff) return show('vic');
      if (v >= 0xd400 && v <= 0xd7ff) return show('sid');
      if (v >= 0xdc00 && v <= 0xddff) return show('cia');
      if (v >= 0xff81 && v <= 0xfff5) return show('kernal');
      return show('memmap');
    }
    if (!root) build();
    root.classList.remove('hidden');
    search.value = w;
    renderNav();
    const first = nav.querySelector('a');
    if (first) first.click(); else show('welcome');
  }

  window.Help = { show, hide, isOpen, forWord };
})();
