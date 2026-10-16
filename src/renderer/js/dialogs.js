/*
 * C64 ACME EDITOR - dialogs: settings, save PRG + Exomizer, SID relocation,
 * SID info, example gallery, about
 * (c) IT-Dummköpfe - MIT License
 */
/* global UI, App */
(function () {
  'use strict';
  const api = window.api;
  const el = UI.el;

  // ---------------------------------------------------------- form helpers
  function row(label, control, help) {
    return el('div', { class: 'form-row' }, el('label', { text: label }), control, help ? el('div', { class: 'help', text: help }) : null);
  }
  function select(value, options) {
    const s = el('select');
    for (const [v, t] of options) s.appendChild(el('option', { value: v, text: t, selected: String(v) === String(value) }));
    return s;
  }
  function checkbox(label, checked) {
    const c = el('input', { type: 'checkbox' });
    c.checked = !!checked;
    return { box: c, node: el('label', { class: 'check' }, c, label) };
  }
  function text(value, attrs) { return el('input', Object.assign({ type: 'text', value: value == null ? '' : value }, attrs || {})); }

  // =============================================================== settings
  async function settings(tabName) {
    const s = await api.getSettings();
    const status = await api.toolStatus();
    const tabs = el('div', { class: 'mtabs' });
    const pages = {};
    const body = el('div', null, tabs);
    const addPage = (id, label) => {
      const b = el('button', { text: label });
      b.addEventListener('click', () => show(id));
      tabs.appendChild(b);
      pages[id] = { btn: b, node: el('div', { class: 'hidden' }) };
      body.appendChild(pages[id].node);
      return pages[id].node;
    };
    const show = (id) => { for (const k of Object.keys(pages)) { pages[k].btn.classList.toggle('active', k === id); pages[k].node.classList.toggle('hidden', k !== id); } };

    // ---- editor
    const pEd = addPage('editor', 'Editor');
    const fTheme = select(s.theme, [['night', 'Night (dark blue)'], ['day', 'Day (light grey)']]);
    const fFont = el('input', { type: 'number', min: 9, max: 36, value: s.fontSize });
    const fTab = select(s.tabSize, [[2, '2'], [4, '4'], [8, '8']]);
    const fSoft = checkbox('Insert spaces instead of tab characters', s.useSoftTabs);
    const fWrap = checkbox('Wrap long lines', s.wordWrap);
    const fInv = checkbox('Show spaces and tabs', s.showInvisibles);
    const fAuto = checkbox('Suggest mnemonics, pseudo opcodes and labels while typing', s.autocomplete !== false);
    const fLive = checkbox('Check with the real ACME in the background while typing', s.liveAcmeCheck);
    pEd.append(row('Theme', fTheme), row('Font size', fFont, 'The font is JetBrains Mono - every character has the same width.'), row('Tab width', fTab),
      row('', fSoft.node), row('', fWrap.node), row('', fInv.node), row('', fAuto.node), row('', fLive.node, 'The editor\'s own checker always runs. ACME additionally confirms the result about one second after you stop typing.'));

    // ---- tools
    const pTools = addPage('tools', 'Tools');
    pTools.appendChild(el('p', { style: 'color:var(--muted)', text: 'The editor comes with ACME, Exomizer, sidreloc and VICE. If a tool is missing or you want to use another version, choose its program file (or folder).' }));
    const paths = Object.assign({}, s.paths);
    const toolRows = el('div');
    const renderTools = (st) => {
      toolRows.innerHTML = '';
      for (const k of ['acme', 'exomizer', 'sidreloc', 'vice']) {
        const t = st[k];
        const choose = el('button', { class: 'btn small', text: 'Choose...' });
        choose.addEventListener('click', async () => { const p = await api.pickTool(k); if (p) { paths[k] = p; renderTools(await api.toolStatus()); } });
        const reset = el('button', { class: 'btn small', text: 'Default', title: 'Use the bundled / system version' });
        reset.addEventListener('click', async () => { paths[k] = ''; await api.setSettings({ paths }); renderTools(await api.toolStatus()); });
        toolRows.appendChild(el('div', { class: 'tool-row' },
          el('div', null, el('b', { text: t.title }), el('div', { class: t.found ? 'st-ok' : 'st-missing', text: t.found ? ('found' + (t.version ? ', ' + t.version : '') + ' (' + t.source + ')') : 'not found' })),
          el('div', { class: 'path', text: t.path || (paths[k] || '-'), title: t.path || '' }),
          choose, reset));
      }
    };
    renderTools(status);
    pTools.appendChild(toolRows);
    const linkP = el('p', { style: 'color:var(--muted);font-size:12px', html: 'Downloads: <a href="#" data-url="https://sourceforge.net/projects/acme-crossass/">ACME</a> - <a href="#" data-url="https://bitbucket.org/magli143/exomizer/wiki/Home">Exomizer</a> - <a href="#" data-url="https://www.linusakesson.net/software/sidreloc/index.php">sidreloc</a> - <a href="#" data-url="https://vice-emu.sourceforge.io/">VICE</a>' });
    linkP.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) { e.preventDefault(); api.openExternal(a.dataset.url); } });
    pTools.appendChild(linkP);

    // ---- VICE
    const v = s.vice;
    const pVice = addPage('vice', 'Emulator (VICE)');
    const vModel = select(v.model, [['c64', 'C64 PAL (breadbin)'], ['c64c', 'C64C PAL (new SID)'], ['c64old', 'C64 PAL (old)'], ['ntsc', 'C64 NTSC'], ['newntsc', 'C64C NTSC'], ['oldntsc', 'C64 NTSC (old)'], ['drean', 'Drean (PAL-N)'], ['auto', 'VICE default']]);
    const vSid = select(v.sidModel, [['auto', 'as the C64 model'], ['0', '6581 (old)'], ['1', '8580 (new)']]);
    const vEngine = select(v.sidEngine, [['auto', 'VICE default'], ['1', 'ReSID'], ['8', 'ReSIDfp'], ['0', 'FastSID']]);
    const vBorders = select(v.borders, [['0', 'Normal'], ['1', 'Full (more border)'], ['2', 'Debug (everything)'], ['3', 'None'], ['auto', 'VICE default']]);
    const vFilter = select(v.filter, [['auto', 'VICE default'], ['0', 'None (sharp pixels)'], ['1', 'CRT emulation'], ['2', 'Scale2x']]);
    const vJoy1 = select(v.joyPort1, [['auto', 'VICE default'], ['0', 'None'], ['1', 'Numpad'], ['2', 'Keyset A'], ['3', 'Keyset B'], ['4', 'Host joystick 1']]);
    const vJoy2 = select(v.joyPort2, [['auto', 'VICE default'], ['0', 'None'], ['1', 'Numpad'], ['2', 'Keyset A'], ['3', 'Keyset B'], ['4', 'Host joystick 1']]);
    const vPrg = select(v.prgMode, [['1', 'Inject into RAM (fastest)'], ['0', 'Virtual file system'], ['2', 'Copy to a D64 disk image'], ['auto', 'VICE default']]);
    const vDouble = checkbox('Double size window', v.doubleSize);
    const vFull = checkbox('Start in full screen', v.fullscreen);
    const vWarp = checkbox('Warp mode while loading (autostart)', v.warpAutostart);
    const vTrue = checkbox('True drive emulation (slower, needed for fast loaders)', v.trueDrive);
    const vSound = checkbox('Sound', v.sound);
    const vLabels = checkbox('Load ACME labels into the VICE monitor (opens the monitor at start)', v.monitorLabels);
    const vDef = checkbox('Ignore the settings saved inside VICE (-default)', v.useDefaults);
    const vExtra = text(v.extraArgs, { placeholder: 'e.g. -reu -reusize 512' });
    const preview = el('div', { class: 'log', style: 'max-height:80px' });
    const viceObj = () => ({
      model: vModel.value, sidModel: vSid.value, sidEngine: vEngine.value, borders: vBorders.value, filter: vFilter.value,
      joyPort1: vJoy1.value, joyPort2: vJoy2.value, prgMode: vPrg.value, doubleSize: vDouble.box.checked, fullscreen: vFull.box.checked,
      warpAutostart: vWarp.box.checked, trueDrive: vTrue.box.checked, sound: vSound.box.checked, monitorLabels: vLabels.box.checked,
      useDefaults: vDef.box.checked, extraArgs: vExtra.value
    });
    const updPreview = async () => { await api.setSettings({ vice: viceObj() }); preview.textContent = 'x64sc ' + (await api.viceArgs('program.prg')).join(' '); };
    pVice.addEventListener('change', updPreview); pVice.addEventListener('input', updPreview);
    pVice.append(row('C64 model', vModel), row('SID chip', vSid), row('SID engine', vEngine), row('Borders', vBorders), row('Video filter', vFilter),
      row('Joystick port 1', vJoy1), row('Joystick port 2', vJoy2, 'Most games use port 2. "Numpad" = cursor keys on the number pad, 0 = fire.'),
      row('Starting PRG files', vPrg), row('', vDouble.node), row('', vFull.node), row('', vWarp.node), row('', vTrue.node), row('', vSound.node), row('', vLabels.node), row('', vDef.node),
      row('Extra arguments', vExtra), row('Command line', preview));
    updPreview();

    // ---- Exomizer
    const x = s.exomizer;
    const pExo = addPage('exomizer', 'Exomizer');
    const xAsk = checkbox('Ask whether to pack when saving a PRG', x.askOnSave);
    const xDef = checkbox('Pack by default', x.defaultPack);
    const xEff = select(x.effect, [['none', 'No effect'], ['x1', 'Border flashing (x1)'], ['x2', 'Border flashing (x2)'], ['x3', 'Border flashing (x3)']]);
    pExo.append(row('', xAsk.node), row('', xDef.node), row('Decrunch effect', xEff));

    show(tabName && pages[tabName] ? tabName : 'editor');
    const r = await UI.modal({ title: 'Settings', body, wide: true, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: 'save', primary: true }] });
    if (r !== 'save') { await api.setSettings({ vice: v }); return; }
    const ns = await api.setSettings({
      theme: fTheme.value, fontSize: Math.max(9, Math.min(36, parseInt(fFont.value, 10) || 15)), tabSize: parseInt(fTab.value, 10),
      useSoftTabs: fSoft.box.checked, wordWrap: fWrap.box.checked, showInvisibles: fInv.box.checked, autocomplete: fAuto.box.checked,
      liveAcmeCheck: fLive.box.checked, paths, vice: viceObj(),
      exomizer: Object.assign({}, x, { askOnSave: xAsk.box.checked, defaultPack: xDef.box.checked, effect: xEff.value })
    });
    App.applySettings(ns);
    UI.toast('Settings saved.', 'ok');
  }

  // ========================================================== save as PRG
  async function savePrg() {
    const tab = App.active;
    const s = await api.getSettings();
    const x = s.exomizer;
    const baseDir = tab.path ? App.path.dirname(tab.path) : (s.lastDir || App.info.documents);
    const outInput = text(App.path.join(baseDir, App.outputName(tab)), { style: 'width:100%' });
    const browse = el('button', { class: 'btn small', text: 'Browse...' });
    browse.addEventListener('click', async () => {
      const p = await api.saveDialog({ title: 'Save PRG', defaultPath: outInput.value, filters: [{ name: 'C64 program', extensions: ['prg'] }] });
      if (p) outInput.value = p;
    });
    const pack = checkbox('Yes, pack the program with Exomizer', x.defaultPack);
    const startSel = select('auto', [['auto', 'Automatic'], ['sys', 'SYS line (sys)'], ['custom', 'Custom address:']]);
    const custom = text(x.customStart || '$080d', { style: 'width:100px' });
    const effect = select(x.effect, [['none', 'No effect'], ['x1', 'Border flashing (x1)'], ['x2', 'Border flashing (x2)'], ['x3', 'Border flashing (x3)']]);
    const exoOpts = el('fieldset', { class: 'fieldset' }, el('legend', { text: 'Exomizer options' }),
      row('Start after unpacking', el('div', { class: 'inline' }, startSel, custom), 'Automatic: the SYS address of the BASIC line for programs at $0801, otherwise the load address.'), row('Decrunch effect', effect));
    const sync = () => { exoOpts.style.opacity = pack.box.checked ? '1' : '.45'; custom.disabled = startSel.value !== 'custom'; };
    pack.box.addEventListener('change', sync); startSel.addEventListener('change', sync); sync();
    const tools = App.toolState || {};
    const exoMissing = tools.exomizer && !tools.exomizer.found;
    const body = el('div', null,
      row('PRG file', el('div', { class: 'inline' }, outInput, browse)),
      el('div', { class: 'fieldset', style: 'padding:10px 12px' }, el('b', { text: 'Pack with Exomizer?' }),
        el('p', { style: 'margin:4px 0 8px;color:var(--muted)', text: 'Exomizer makes the program much smaller. It unpacks itself after RUN and then starts your code.' }),
        pack.node, exoMissing ? el('p', { style: 'color:var(--err)', text: 'Exomizer was not found - see Settings > Tools.' }) : null),
      exoOpts);
    const r = await UI.modal({ title: 'Save as PRG', subtitle: `Assemble "${tab.title}" with ACME and write a C64 program file.`, body, buttons: [{ label: 'Cancel', value: null }, { label: 'Save PRG', value: 'ok', primary: true }] });
    if (r !== 'ok') return;
    const out = outInput.value.trim();
    if (!out) return;
    await api.setSettings({ exomizer: Object.assign({}, x, { defaultPack: pack.box.checked, effect: effect.value, customStart: custom.value }) });
    const res = await App.assembleTab(tab, {});
    if (!res) return;
    if (pack.box.checked) {
      let start = startSel.value === 'custom' ? toExoAddr(custom.value) : startSel.value === 'sys' ? 'sys' : App.packStart(res);
      if (!start) { UI.toast('Invalid start address.', 'err'); return; }
      const p = await api.pack({ input: res.outFile, output: out, start, effect: effect.value });
      App.log(p.log, p.ok ? 'ok' : 'err');
      if (!p.ok) { UI.toast(p.missing ? 'Exomizer was not found (Settings > Tools).' : 'Exomizer failed - see Output.', 'err'); App.showPanel('output'); return; }
      UI.toast(`Saved ${App.path.basename(out)}: ${p.size} bytes (packed from ${res.size + 2}).`, 'ok', 6000);
    } else {
      await api.copyFile(res.outFile, out);
      UI.toast(`Saved ${App.path.basename(out)}: ${UI.hex(res.start, 4)}-${UI.hex(res.end - 1, 4)}, ${res.size + 2} bytes.`, 'ok', 6000);
    }
  }

  function toExoAddr(s) {
    const v = UI.parseNum(s);
    if (isNaN(v) || v < 0 || v > 0xffff) return null;
    return '0x' + v.toString(16);
  }

  // ===================================================== pack an existing PRG
  async function packFile() {
    const f = await api.openDialog({ title: 'Choose a PRG to pack', filters: [{ name: 'C64 program', extensions: ['prg'] }] });
    if (!f) return;
    const input = f[0];
    const outInput = text(input.replace(/\.prg$/i, '') + '_packed.prg', { style: 'width:100%' });
    const startSel = select('sys', [['sys', 'sys - SYS address of the BASIC line'], ['custom', 'Custom address:']]);
    const custom = text('$080d', { style: 'width:100px' });
    const effect = select('none', [['none', 'No effect'], ['x1', 'Border flashing (x1)'], ['x2', 'Border flashing (x2)'], ['x3', 'Border flashing (x3)']]);
    const body = el('div', null, row('Input', el('div', { text: input })), row('Output', outInput), row('Start', el('div', { class: 'inline' }, startSel, custom)), row('Effect', effect));
    const r = await UI.modal({ title: 'Pack with Exomizer', body, buttons: [{ label: 'Cancel', value: null }, { label: 'Pack', value: 'ok', primary: true }] });
    if (r !== 'ok') return;
    const start = startSel.value === 'custom' ? toExoAddr(custom.value) : 'sys';
    const p = await api.pack({ input, output: outInput.value, start, effect: effect.value });
    App.log(p.log, p.ok ? 'ok' : 'err');
    const st = await api.stat(input);
    if (p.ok) UI.toast(`Packed: ${st ? st.size : '?'} -> ${p.size} bytes.`, 'ok', 6000); else { UI.toast('Exomizer failed - see Output.', 'err'); App.showPanel('output'); }
  }

  // ============================================================ SID info
  function sidInfoNode(h) {
    const dl = el('dl', { class: 'kv' });
    const add = (k, v) => dl.append(el('dt', { text: k }), el('dd', { text: v }));
    add('Name', h.name); add('Author', h.author); add('Released', h.released);
    add('Format', `${h.type} version ${h.version}`);
    add('Load address', `${UI.hex(h.loadAddress, 4)} - ${UI.hex(h.endAddress, 4)} (${h.dataSize} bytes)`);
    add('Init / play', `${UI.hex(h.initAddress, 4)} / ${h.playAddress ? UI.hex(h.playAddress, 4) : 'installs its own IRQ'}`);
    add('Songs', `${h.songs} (start with song ${h.startSong})`);
    add('Speed', h.speed ? 'CIA timer (may need multispeed calls)' : '50 Hz (once per frame)');
    add('ACME include', `* = ${UI.hex(h.loadAddress, 4)}  /  !bin "file.sid",, ${UI.hex(h.skip, 2)}`);
    return dl;
  }

  async function sidInfo() {
    const f = await api.openDialog({ title: 'Choose a SID file', filters: [{ name: 'SID music', extensions: ['sid'] }] });
    if (!f) return;
    const h = await api.sidInfo(f[0]);
    if (!h) { UI.toast('This is not a PSID/RSID file.', 'err'); return; }
    await UI.modal({ title: 'SID file info', subtitle: f[0], body: sidInfoNode(h) });
  }

  // ======================================================= SID relocation
  async function sidReloc() {
    const f = await api.openDialog({ title: 'Choose the SID tune to relocate', filters: [{ name: 'SID music', extensions: ['sid'] }] });
    if (!f) return;
    const input = f[0];
    const h = await api.sidInfo(input);
    if (!h) { UI.toast('This is not a PSID/RSID file.', 'err'); return; }
    const target = text('$c000', { style: 'width:110px' });
    const out = text('', { style: 'width:100%' });
    const updOut = () => { const v = UI.parseNum(target.value); out.value = input.replace(/\.sid$/i, '') + '_' + (isNaN(v) ? 'xxxx' : v.toString(16).padStart(4, '0')) + '.sid'; };
    target.addEventListener('input', updOut); updOut();
    const zpMode = select('range', [['range', 'Move zero page use into this range:'], ['keep', 'Keep the zero page addresses (-k)']]);
    const zp = text('80-ff', { style: 'width:90px' });
    const force = checkbox('Write the file even if the check finds differences (-f)', false);
    const strict = checkbox('Also check pulse widths (-s)', false);
    const log = el('div', { class: 'log hidden' });
    const body = el('div', null,
      sidInfoNode(h),
      el('div', { style: 'height:12px' }),
      row('New start address', target, 'Must be a page start ($xx00). sidreloc moves all code and data and verifies the result by emulation.'),
      row('Zero page', el('div', { class: 'inline' }, zpMode, zp)),
      row('', force.node), row('', strict.node),
      row('Output file', out),
      log);
    const r = await UI.modal({
      title: 'Relocate SID (sidreloc)', subtitle: 'Moves a SID tune to another memory address.', body, wide: true,
      buttons: [{ label: 'Close', value: null }, {
        label: 'Relocate', primary: true, onClick: async (close, btn) => {
          const v = UI.parseNum(target.value);
          if (isNaN(v) || v < 0x0200 || v > 0xff00 || (v & 0xff)) { UI.toast('Please enter a page address like $c000 or $2000.', 'err'); return false; }
          btn.disabled = true; btn.textContent = 'Working...';
          const res = await api.sidreloc({ input, output: out.value, page: (v >> 8).toString(16).padStart(2, '0'), zp: zpMode.value === 'range' ? zp.value : null, keepZp: zpMode.value === 'keep', force: force.box.checked, strict: strict.box.checked });
          btn.disabled = false; btn.textContent = 'Relocate';
          log.classList.remove('hidden');
          log.textContent = res.message + (res.warnings && res.warnings.length ? '\n' + res.warnings.join('\n') : '') + '\n\n' + res.log;
          App.log(res.log, res.ok ? 'ok' : 'err');
          if (res.missing) { UI.toast('sidreloc was not found (Settings > Tools).', 'err'); return false; }
          if (res.ok) {
            UI.toast('SID relocated: ' + App.path.basename(out.value), 'ok', 6000);
            const ins = await UI.confirm('SID relocated', `The tune now loads at ${UI.hex(v, 4)}. Insert an !bin include for it into the current source?`, 'Insert');
            if (ins && App.active) {
              const base = App.active.path ? App.path.dirname(App.active.path) : App.active.baseDir;
              const rel = App.path.relative(base, out.value);
              const nh = await api.sidInfo(out.value);
              App.editor.insert(`; ---- SID "${h.name}" relocated to ${UI.hex(v, 4)} ----\nMUSIC_INIT = ${UI.hex(nh ? nh.initAddress : v, 4)}\nMUSIC_PLAY = ${UI.hex(nh ? nh.playAddress : v + 3, 4)}\n        * = ${UI.hex(v, 4)}\nmusic   !bin "${rel}",, ${UI.hex(nh ? nh.skip : 0x7e, 2)}\n`);
            }
            close('done');
          }
          return false;
        }
      }]
    });
    void r;
  }

  // ======================================================== example gallery
  async function examples() {
    const { list } = await api.examples();
    const grid = el('div', { class: 'ex-list' });
    let chosen = null;
    for (const ex of list) {
      const card = el('div', { class: 'ex-card', tabindex: '0', role: 'button' },
        el('h3', { text: ex.title }), el('span', { class: 'lvl', text: ex.level + ' - ' + ex.file }), el('p', { text: ex.description }));
      const pick = () => { chosen = ex.file; UI.modalApi.close('open'); };
      card.addEventListener('click', pick);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      grid.appendChild(card);
    }
    const r = await UI.modal({ title: 'Example programs', subtitle: 'Every example is fully commented. Open one and press F5 to run it in VICE.', body: grid, wide: true });
    if (r === 'open' && chosen) await App.openExample(chosen);
  }

  // ================================================================ about
  async function about() {
    const info = App.info;
    const st = App.toolState || await api.toolStatus();
    const body = el('div', null,
      el('div', { class: 'about-head' }, el('span', { class: 'stripes', html: '<i></i><i></i><i></i><i></i><i></i>' }),
        el('div', null, el('h3', { text: `${info.name}` }), el('p', { text: `Version ${info.version}  -  by ${info.author}` }))),
      el('p', { text: 'An editor for 6502 assembler on the Commodore 64 with live checking, memory map, ACME, Exomizer, sidreloc, VICE and a help center.' }),
      el('h3', { text: 'Included tools and components' }),
      el('ul', { class: 'src-list', html: [
        `ACME crossassembler by Marco Baye (GPL) - ${st.acme && st.acme.found ? 'found: ' + UI.esc(st.acme.path) : 'not found'}`,
        `Exomizer by Magnus Lind (free software, see its license) - ${st.exomizer && st.exomizer.found ? 'found' : 'not found'}`,
        `sidreloc by Linus Åkesson (MIT license) - ${st.sidreloc && st.sidreloc.found ? 'found' : 'not found'}`,
        `VICE - the Versatile Commodore Emulator, by the VICE team (GPL) - ${st.vice && st.vice.found ? 'found' : 'not found'}`,
        'Ace code editor (BSD license)', 'JetBrains Mono font (SIL Open Font License)',
        `Electron ${UI.esc(info.electron)} / Chromium ${UI.esc(info.chrome)} (MIT / BSD)`
      ].map(t => `<li>${t}</li>`).join('') }),
      el('h3', { text: 'Sources' }),
      el('ul', { class: 'src-list', html: [
        ['C64-Wiki: ACME', 'https://www.c64-wiki.de/wiki/ACME'],
        ['C64-Wiki: Exomizer', 'https://www.c64-wiki.de/wiki/Exomizer'],
        ['C64-Wiki: VICE', 'https://www.c64-wiki.de/wiki/VICE'],
        ['sidreloc (Linus Åkesson)', 'https://www.linusakesson.net/software/sidreloc/index.php'],
        ['C64-Wiki: Übersicht 6502-Assemblerbefehle', 'https://www.c64-wiki.de/wiki/%C3%9Cbersicht_6502-Assemblerbefehle'],
        ['C64-Wiki: Speicherbelegungsplan', 'https://www.c64-wiki.de/wiki/Speicherbelegungsplan'],
        ['pagetable.com: C64 Memory Map', 'https://pagetable.com/c64ref/c64mem/'],
        ['pagetable.com: C64 BASIC & KERNAL ROM Disassembly', 'https://pagetable.com/c64ref/c64disasm/'],
        ['pagetable.com: C64 Character Set (PETSCII)', 'https://pagetable.com/c64ref/charset/'],
        ['ACME documentation (QuickRef, AllPOs, Errors, AddrModes, Illegals)', 'https://sourceforge.net/projects/acme-crossass/'],
        ['VICE manual - command line options', 'https://vice-emu.sourceforge.io/'],
        ['Exomizer home page', 'https://bitbucket.org/magli143/exomizer/wiki/Home'],
        ['sidreloc manual', 'https://www.linusakesson.net/software/sidreloc/sidreloc.txt'],
        ['High Voltage SID Collection (PSID format)', 'https://www.hvsc.c64.org/'],
        ['Ace editor', 'https://ace.c9.io/'],
        ['JetBrains Mono', 'https://www.jetbrains.com/lp/mono/'],
        ['Electron', 'https://www.electronjs.org/']
      ].map(([t, u]) => `<li><a href="#" data-url="${u}">${UI.esc(t)}</a></li>`).join('') }),
      el('p', { style: 'color:var(--muted);font-size:12px', text: `Settings folder: ${info.userData}  -  ${info.platform} ${info.arch}` }));
    body.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a && a.dataset.url) { e.preventDefault(); api.openExternal(a.dataset.url); } });
    await UI.modal({ title: 'Info', body, wide: true });
  }

  window.Dialogs = { settings, savePrg, packFile, sidInfo, sidReloc, examples, about };
})();
