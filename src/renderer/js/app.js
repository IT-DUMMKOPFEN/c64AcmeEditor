/*
 * C64 ACME EDITOR - application (tabs, editor, live checking, build & run)
 * (c) IT-Dummköpfe - MIT License
 */
/* global ace, UI, C64Asm, C64Opcodes, C64Analyzer, MemMap, Converter, Help, HelpContent, Dialogs */
(function () {
  'use strict';
  const api = window.api;
  const O = C64Opcodes;
  const Range = ace.require('ace/range').Range;
  const UndoManager = ace.require('ace/undomanager').UndoManager;
  const AcmeMode = ace.require('ace/mode/acme').Mode;
  const acmeMode = new AcmeMode();

  const App = window.App = {
    info: null, settings: null, toolState: null,
    tabs: [], active: null, editor: null, nextId: 1
  };

  // ------------------------------------------------------------ path helpers
  const P = App.path = {
    sep: (p) => (p && p.includes('\\') && !p.includes('/')) ? '\\' : '/',
    dirname: (p) => { if (!p) return ''; const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')); return i > 0 ? p.slice(0, i) : (i === 0 ? p.slice(0, 1) : ''); },
    basename: (p) => String(p || '').split(/[\\/]/).pop(),
    join: (a, b) => { if (!a) return b; if (/^([a-zA-Z]:)?[\\/]/.test(b)) return b; const s = P.sep(a); return a.replace(/[\\/]+$/, '') + s + b.replace(/\//g, s); },
    isAbs: (p) => /^([a-zA-Z]:)?[\\/]/.test(p || ''),
    ext: (p) => { const b = P.basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : ''; },
    stem: (p) => { const b = P.basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(0, i) : b; },
    relative: (from, to) => {
      const a = from.split(/[\\/]/).filter(Boolean), b = to.split(/[\\/]/).filter(Boolean);
      if (a[0] !== b[0] && /^[a-zA-Z]:$/.test(a[0] || '')) return to;
      let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
      return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/');
    }
  };

  // ------------------------------------------------- address descriptions
  const ADDR_INFO = new Map();
  (function buildAddrInfo() {
    const add = (spec, name, desc) => {
      const m = String(spec).match(/\$([0-9A-F]{2,4})(?:\s*-\s*\$([0-9A-F]{2,4}))?(?:\s*\/\s*\$([0-9A-F]{2,4}))?(?:\s*\/\s*\$([0-9A-F]{2,4}))?/i);
      if (!m) return;
      const a = parseInt(m[1], 16);
      if (m[2]) {
        const b = parseInt(m[2], 16);
        if (b - a <= 16) for (let x = a; x <= b; x++) if (!ADDR_INFO.has(x)) ADDR_INFO.set(x, { name: name + (b - a < 16 ? '' : ''), desc });
      } else {
        ADDR_INFO.set(a, { name, desc });
        if (m[3]) ADDR_INFO.set(parseInt(m[3], 16), { name, desc });
        if (m[4]) ADDR_INFO.set(parseInt(m[4], 16), { name, desc });
      }
    };
    const T = HelpContent.tables;
    T.VIC.forEach(r => add(r[0], 'VIC-II: ' + r[1], r[2]));
    T.SID.forEach(r => add(r[0], 'SID: ' + r[1], r[2]));
    T.CIA.forEach(r => add(r[0], r[1], r[2]));
    T.ZP.forEach(r => add(r[0], r[1], r[2]));
    T.KERNAL.forEach(r => add(r[0], 'KERNAL ' + r[1], r[2]));
    T.ROUTINES.forEach(r => add(r[0], r[1], r[2]));
    // sprite registers in detail
    for (let n = 0; n < 8; n++) {
      ADDR_INFO.set(0xd000 + n * 2, { name: `VIC-II: sprite ${n} X`, desc: 'X position (bits 0-7). Bit 8 is in $D010.' });
      ADDR_INFO.set(0xd001 + n * 2, { name: `VIC-II: sprite ${n} Y`, desc: 'Y position.' });
      ADDR_INFO.set(0xd027 + n, { name: `VIC-II: sprite ${n} colour`, desc: 'Colour 0-15.' });
      ADDR_INFO.set(0x07f8 + n, { name: `Sprite ${n} pointer`, desc: 'Data address / 64 (default screen at $0400).' });
    }
    for (let v = 0; v < 3; v++) {
      const b = 0xd400 + v * 7;
      const names = ['frequency lo', 'frequency hi', 'pulse width lo', 'pulse width hi', 'control (gate, waveform)', 'attack / decay', 'sustain / release'];
      names.forEach((n, i) => ADDR_INFO.set(b + i, { name: `SID: voice ${v + 1} ${n}`, desc: i === 4 ? 'Bit 0 gate, 4 triangle, 5 sawtooth, 6 pulse, 7 noise.' : '' }));
    }
  })();

  // ============================================================ startup
  async function init() {
    App.info = await api.info();
    App.settings = await api.getSettings();
    document.getElementById('brandVersion').textContent = App.info.version;
    applyTheme(App.settings.theme, false);

    const editor = App.editor = ace.edit('editor', {
      mode: acmeMode,
      theme: App.settings.theme === 'day' ? 'ace/theme/c64-day' : 'ace/theme/c64-night',
      fontSize: App.settings.fontSize,
      fontFamily: "'JetBrains Mono', monospace",
      showPrintMargin: false,
      highlightActiveLine: true,
      highlightSelectedWord: true,
      scrollPastEnd: 0.4,
      displayIndentGuides: true,
      showFoldWidgets: true,
      animatedScroll: false,
      wrap: !!App.settings.wordWrap,
      showInvisibles: !!App.settings.showInvisibles,
      tabSize: App.settings.tabSize || 8,
      useSoftTabs: App.settings.useSoftTabs !== false,
      useWorker: false
    });
    setupCompletion();
    editor.commands.addCommand({ name: 'gotoline', bindKey: { win: 'Ctrl-L', mac: 'Command-L' }, exec: () => command('edit:gotoLine') });
    editor.commands.addCommand({ name: 'helpword', bindKey: { win: 'Ctrl-F1', mac: 'Command-F1' }, exec: () => command('help:context') });
    editor.on('mousemove', onEditorHover);
    editor.container.addEventListener('mouseleave', UI.hideTip);
    editor.on('focus', UI.hideTip);
    editor.renderer.on('afterRender', () => { /* keeps markers in sync */ });

    // toolbar + panel buttons
    document.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (b) { command(b.dataset.cmd, b.dataset.arg); }
    });
    for (const b of document.querySelectorAll('.btab')) b.addEventListener('click', () => showPanel(b.dataset.panel));
    setupResize();
    api.onMenu((cmd, arg) => command(cmd, arg));
    api.onRequestClose(onRequestClose);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && Help.isOpen()) Help.hide();
    });

    Converter.init(document.getElementById('converter'), {
      getSymbols: () => (App.active && App.active.result) ? App.active.result.symbolMap : new Map(),
      getPc: () => { const i = currentLineInfo(); return i ? i.pc : null; },
      insert: (text) => { if (App.active) { App.editor.insert(text); App.editor.focus(); } },
      onToggle: () => setTimeout(() => App.editor.resize(), 10)
    });

    if (!App.settings.showMemoryMap && !App.settings.showProblems) document.getElementById('bottom').classList.add('collapsed');

    // tools
    refreshToolState();

    // files from the command line / last session
    const pending = await api.pendingFiles();
    const session = (App.settings.session && App.settings.session.files) || [];
    const toOpen = pending.length ? pending : session;
    for (const f of toOpen) { try { if (await api.exists(f)) await openPath(f, true); } catch (e) { /* ignore */ } }
    if (!pending.length && App.settings.session && App.settings.session.active) {
      const t = App.tabs.find(x => x.path === App.settings.session.active);
      if (t) activate(t);
    }
    renderTabs();
    if (!App.tabs.length) showWelcome(true);
  }

  async function refreshToolState() {
    try {
      App.toolState = await api.toolStatus();
      const a = App.toolState.acme;
      setAcmeStatus(a.found ? `ACME ${a.version || ''}`.trim() : 'ACME not found', !a.found);
      const missing = Object.keys(App.toolState).filter(k => !App.toolState[k].found);
      if (missing.length) {
        logOutput(`Tools not found: ${missing.map(k => App.toolState[k].title).join(', ')}. Set their paths in Settings > Tools.`, 'err');
      }
    } catch (e) { /* ignore */ }
  }

  // ============================================================== theme
  function applyTheme(theme, save) {
    document.body.classList.toggle('theme-day', theme === 'day');
    document.body.classList.toggle('theme-night', theme !== 'day');
    if (App.editor) App.editor.setTheme(theme === 'day' ? 'ace/theme/c64-day' : 'ace/theme/c64-night');
    App.settings.theme = theme;
    if (save) api.setSettings({ theme });
  }

  // =============================================================== tabs
  function newTab(opts) {
    const session = ace.createEditSession(opts.text || '', acmeMode);
    session.setUndoManager(new UndoManager());
    session.setTabSize(App.settings.tabSize || 8);
    session.setUseSoftTabs(App.settings.useSoftTabs !== false);
    session.setUseWrapMode(!!App.settings.wordWrap);
    const tab = {
      id: App.nextId++, path: opts.path || null, title: opts.title || (opts.path ? P.basename(opts.path) : 'untitled.asm'),
      session, dirty: false, baseDir: opts.baseDir || (opts.path ? P.dirname(opts.path) : (App.settings.lastDir || App.info.documents)),
      exampleBase: opts.exampleBase || null, asm: new C64Asm.Assembler(null), result: null,
      diags: [], acmeDiags: [], sanity: [], markerIds: [], version: 0, acmeVersion: -1, savedVersion: 0
    };
    tab.asm.io = makeIo(tab);
    session.selection.on('changeCursor', () => { if (App.active === tab) { updateStatus(); updateHint(); } });
    session.selection.on('changeSelection', () => { if (App.active === tab) updateStatus(); });
    session.on('change', () => {
      tab.version++;
      setDirty(tab, true);
      tab.sanity = [];
      scheduleAnalysis(tab);
    });
    App.tabs.push(tab);
    activate(tab);
    runAnalysis(tab);
    return tab;
  }

  function makeIo(tab) {
    const cache = new Map();
    tab.ioCache = cache;
    const mainId = () => tab.path || ('untitled:' + tab.id);
    const from = (f) => (f && P.isAbs(f) ? f : (tab.path || ''));
    return {
      readSource(name, fromFile) {
        const k = 's|' + name + '|' + from(fromFile);
        if (!cache.has(k)) cache.set(k, api.includeSource(name, from(fromFile), tab.baseDir));
        void mainId;
        return cache.get(k);
      },
      binaryInfo(name, fromFile) {
        const k = 'b|' + name + '|' + from(fromFile);
        if (!cache.has(k)) cache.set(k, api.includeBinary(name, from(fromFile), tab.baseDir));
        return cache.get(k);
      }
    };
  }

  function activate(tab) {
    App.active = tab;
    showWelcome(false);
    App.editor.setSession(tab.session);
    App.editor.setReadOnly(false);
    renderTabs();
    refreshPanels();
    updateStatus();
    updateHint();
    updateTitle();
    saveSession();
    setTimeout(() => App.editor.focus(), 0);
  }

  function setDirty(tab, d) {
    if (!d) tab.savedVersion = tab.version;
    const dirty = d && tab.version !== tab.savedVersion;
    if (tab.dirty === dirty) return;
    tab.dirty = dirty;
    renderTabs();
    updateTitle();
  }

  function renderTabs() {
    const bar = document.getElementById('tabs');
    bar.innerHTML = '';
    for (const t of App.tabs) {
      const errors = problemsOf(t).filter(d => d.severity === 'error').length;
      const el = UI.el('div', { class: 'tab' + (t === App.active ? ' active' : '') + (t.dirty ? ' is-dirty' : ''), role: 'tab', title: t.path || 'Not saved yet' },
        UI.el('span', { class: 'name', text: t.title }),
        errors ? UI.el('span', { class: 'err-dot', text: String(errors), title: errors + ' errors' }) : null,
        UI.el('span', { class: 'dirty', title: 'Unsaved changes' }));
      const close = UI.el('button', { class: 'close', title: 'Close (Ctrl+W)', text: 'x' });
      close.addEventListener('click', (e) => { e.stopPropagation(); closeTab(t); });
      el.appendChild(close);
      el.addEventListener('click', () => activate(t));
      el.addEventListener('auxclick', (e) => { if (e.button === 1) closeTab(t); });
      bar.appendChild(el);
    }
  }

  function updateTitle() {
    const t = App.active;
    api.setTitle(`${t ? (t.dirty ? '* ' : '') + t.title + ' - ' : ''}${App.info.name} ${App.info.version}`);
  }

  async function closeTab(tab) {
    if (tab.dirty) {
      const r = await UI.modal({
        title: 'Unsaved changes', body: UI.el('p', { text: `"${tab.title}" has unsaved changes.` }),
        buttons: [{ label: 'Cancel', value: 'cancel' }, { label: "Don't save", value: 'discard' }, { label: 'Save', value: 'save', primary: true }]
      });
      if (r === 'cancel' || r === null) return false;
      if (r === 'save' && !(await saveTab(tab))) return false;
    }
    const i = App.tabs.indexOf(tab);
    App.tabs.splice(i, 1);
    if (App.active === tab) {
      App.active = null;
      const next = App.tabs[Math.min(i, App.tabs.length - 1)];
      if (next) activate(next); else { showWelcome(true); refreshPanels(); updateStatus(); }
    }
    renderTabs();
    saveSession();
    updateTitle();
    return true;
  }

  function saveSession() {
    const files = App.tabs.filter(t => t.path).map(t => t.path);
    api.setSettings({ session: { files, active: App.active && App.active.path } });
  }

  function showWelcome(show) {
    const w = document.getElementById('welcome');
    if (show) {
      w.innerHTML = '';
      const box = UI.el('div', { class: 'welcome-box' },
        UI.el('div', { class: 'brand' }, UI.el('span', { class: 'stripes', html: '<i></i><i></i><i></i><i></i><i></i>' }), UI.el('h1', { text: `${App.info.name}` })),
        UI.el('div', { class: 'welcome-meta' }, `Version ${App.info.version}  \u2022  by ${App.info.author}`),
        UI.el('p', { text: 'Write 6502 assembler for the Commodore 64 with ACME. Every line is checked while you type, the memory map shows what you use, F5 runs your program in VICE.' }),
        UI.el('p', { class: 'welcome-vice' }),
        UI.el('div', { class: 'ready', text: 'READY.' }));
      // VICE is not bundled: tell the user how to get it when it is missing
      const viceNote = box.querySelector('.welcome-vice');
      const showVice = (st) => {
        if (!st || !st.vice || st.vice.found) { viceNote.remove(); return; }
        viceNote.innerHTML = 'VICE is not included and was not found on this computer. To run your programs, please <a href="#" data-url="https://vice-emu.sourceforge.io/index.html#download">install VICE</a> and, if needed, set its path in <a href="#" data-cmd="settings:open" data-arg="tools">Settings &gt; Tools</a>.';
      };
      if (App.toolState) showVice(App.toolState); else api.toolStatus().then(showVice).catch(() => viceNote.remove());
      box.addEventListener('click', (e) => { const a = e.target.closest('a[data-url]'); if (a) { e.preventDefault(); api.openExternal(a.dataset.url); } });
      const actions = UI.el('div', { class: 'welcome-actions' });
      for (const [label, cmd, primary] of [['New file', 'file:new', true], ['Open file', 'file:open'], ['Example programs', 'examples:gallery'], ['Help center', 'help:open'], ['Info', 'help:about']]) {
        const b = UI.el('button', { class: 'btn' + (primary ? ' primary' : ''), text: label, 'data-cmd': cmd });
        actions.appendChild(b);
      }
      box.appendChild(actions);
      w.appendChild(box);
    }
    w.classList.toggle('hidden', !show);
  }

  // ====================================================== VICE missing
  // VICE is not bundled with the editor (since 0.2b). When it cannot be found
  // we explain how to install it and let the user point to x64sc directly.
  async function viceMissing(prg, labels) {
    const plat = App.info.platform;
    const how = plat === 'win32'
      ? 'Windows: download the GTK3 VICE zip from the VICE home page, unpack it (for example to C:\\VICE) and choose bin\\x64sc.exe below.'
      : plat === 'darwin'
        ? 'macOS: download the VICE .dmg for macOS from the VICE home page and copy VICE to Applications - the editor finds it there. (With Homebrew: brew install vice.)'
        : 'Linux: install VICE with your package manager (Debian/Ubuntu: sudo apt install vice) or as Flatpak: flatpak install flathub net.sf.VICE. Note: some distributions ship VICE without the C64 ROMs.';
    const body = UI.el('div', null,
      UI.el('p', { text: 'VICE, the C64 emulator, is not included in the C64 ACME EDITOR. Please install it once - after that F5 runs your programs directly.' }),
      UI.el('p', { text: how }),
      UI.el('p', { style: 'color:var(--muted);font-size:12px', text: 'The editor looks for x64sc in your PATH, in the usual program folders and in the path set in Settings > Tools.' }));
    const r = await UI.modal({
      title: 'VICE not found', body,
      buttons: [{ label: 'Close', value: null }, { label: 'Open the VICE download page', value: 'web' }, { label: 'Locate x64sc...', value: 'pick', primary: true }]
    });
    if (r === 'web') api.openExternal('https://vice-emu.sourceforge.io/index.html#download');
    if (r === 'pick') {
      const p = await api.pickTool('vice');
      if (!p) return;
      await refreshToolState();
      if (App.toolState && App.toolState.vice && !App.toolState.vice.found) { UI.toast('This does not look like VICE (x64sc). Please try again.', 'err'); return; }
      UI.toast('VICE found: ' + p, 'ok', 4000);
      if (prg !== undefined) {
        const v = await api.runVice(prg, labels);
        logOutput(v.log, v.ok ? '' : 'err');
        if (!v.ok) UI.toast('Could not start VICE - see Output.', 'err');
      }
    }
  }

  // ======================================================= file handling
  const SOURCE_FILTERS = [{ name: 'ACME source', extensions: ['asm', 'a', 's', 'acme', 'inc', 'src', 'txt'] }, { name: 'All files', extensions: ['*'] }];

  async function openPath(path, quiet) {
    const existing = App.tabs.find(t => t.path === path);
    if (existing) { activate(existing); return existing; }
    try {
      const f = await api.readFile(path);
      const t = newTab({ path: f.path, text: f.text });
      setDirty(t, false);
      return t;
    } catch (e) {
      if (!quiet) UI.toast('Could not open ' + path + ': ' + e.message, 'err');
      return null;
    }
  }

  async function saveTab(tab, forceDialog) {
    if (!tab) return false;
    let path = tab.path;
    if (!path || forceDialog) {
      const def = tab.path || P.join(tab.exampleBase ? (App.settings.lastDir || P.join(App.info.documents, 'C64 ACME Editor')) : tab.baseDir, tab.title);
      path = await api.saveDialog({ title: 'Save source', defaultPath: def, filters: SOURCE_FILTERS });
      if (!path) return false;
    }
    try {
      const text = tab.session.getValue();
      await api.writeFile(path, text);
      const oldBase = tab.exampleBase || (tab.path ? P.dirname(tab.path) : null);
      const newDir = P.dirname(path);
      // copy included files (SID, pictures, sources) next to the new location
      if (oldBase && oldBase !== newDir && tab.result) await copyIncludes(tab, oldBase, newDir);
      tab.path = path; tab.title = P.basename(path); tab.baseDir = newDir; tab.exampleBase = null;
      tab.ioCache.clear();
      setDirty(tab, false);
      renderTabs(); updateTitle(); saveSession(); updateStatus();
      App.settings.lastDir = newDir;
      scheduleAnalysis(tab);
      return true;
    } catch (e) {
      UI.toast('Could not save: ' + e.message, 'err');
      return false;
    }
  }

  async function copyIncludes(tab, fromDir, toDir) {
    const names = new Set();
    for (const b of tab.result.binaries || []) if (!P.isAbs(b.name)) names.add(b.name);
    for (const f of tab.result.files || []) if (P.isAbs(f) && f.startsWith(fromDir) && f !== tab.path) names.add(P.relative(fromDir, f));
    let copied = 0;
    for (const n of names) {
      const src = P.join(fromDir, n), dst = P.join(toDir, n);
      try {
        if (await api.exists(src) && !(await api.exists(dst))) { await api.copyFile(src, dst); copied++; }
      } catch (e) { /* ignore */ }
    }
    if (copied) UI.toast(`Copied ${copied} included file${copied > 1 ? 's' : ''} next to the source.`, 'ok');
  }

  async function openExample(file) {
    const { dir } = await api.examples();
    const full = P.join(dir, file);
    try {
      const f = await api.readFile(full, { noRecent: true });
      const t = newTab({ text: f.text, title: P.basename(file), baseDir: P.dirname(full), exampleBase: P.dirname(full) });
      setDirty(t, false);
      UI.toast('Example opened. Press F5 to run it. "Save" stores your own copy.', 'ok');
    } catch (e) { UI.toast('Could not open the example: ' + e.message, 'err'); }
  }

  async function onRequestClose() {
    const dirty = App.tabs.filter(t => t.dirty);
    if (dirty.length) {
      const r = await UI.modal({
        title: 'Unsaved changes',
        body: UI.el('p', { text: `${dirty.length} file${dirty.length > 1 ? 's have' : ' has'} unsaved changes: ${dirty.map(t => t.title).join(', ')}` }),
        buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Quit without saving', value: 'discard' }, { label: 'Save all and quit', value: 'save', primary: true }]
      });
      if (r === 'cancel' || r === null) return;
      if (r === 'save') for (const t of dirty) if (!(await saveTab(t))) return;
    }
    saveSession();
    api.closeConfirmed();
  }

  // ========================================================== analysis
  function scheduleAnalysis(tab) {
    clearTimeout(tab.timer);
    tab.timer = setTimeout(() => runAnalysis(tab), 220);
    clearTimeout(tab.acmeTimer);
    if (App.settings.liveAcmeCheck) tab.acmeTimer = setTimeout(() => runAcme(tab, false), 1400);
  }

  function mainId(tab) { return tab.path || ('untitled:' + tab.id); }

  function runAnalysis(tab) {
    const text = tab.session.getValue();
    tab.ioCache.clear();
    let r;
    try {
      r = tab.asm.analyze(text, mainId(tab));
    } catch (e) {
      console.error(e);
      r = { diags: [{ severity: 'warning', file: mainId(tab), line: 0, col: 0, endCol: 1, message: 'Internal checker problem: ' + e.message, hint: 'The real ACME check still works (F7).' }], ranges: [], segments: [], symbols: [], symbolMap: new Map(), instrs: [], lineInfo: new Map(), binaries: [], outputs: [] };
    }
    r.mainPath = mainId(tab);
    tab.result = r;
    tab.diags = r.diags.map(d => Object.assign({ source: 'live' }, d));
    if (tab === App.active) { applyMarkers(tab); refreshPanels(); updateHint(); updateStatus(); }
    renderTabs();
  }

  async function runAcme(tab, explicit) {
    if (!App.toolState || !App.toolState.acme.found) {
      if (explicit) UI.toast('ACME was not found. Set its path in Settings > Tools.', 'err');
      return null;
    }
    const version = tab.version;
    setAcmeStatus('ACME checking ...', false);
    const r = await api.assemble({ source: tab.session.getValue(), docPath: tab.path, baseDir: tab.baseDir });
    if (tab.version !== version && !explicit) return r;   // outdated
    const doc = tab.path || 'untitled';
    tab.acmeDiags = r.diags.map(d => {
      const isMain = d.file === doc || d.file === tab.path;
      const hint = acmeHint(d.message);
      return Object.assign({}, d, { file: isMain ? mainId(tab) : d.file, hint: hint ? hint[2] : '', explain: hint ? hint[1] : '', source: 'acme' });
    });
    tab.acmeVersion = version;
    const errs = tab.acmeDiags.filter(d => d.severity === 'error').length;
    setAcmeStatus(r.missing ? 'ACME not found' : errs ? `ACME: ${errs} error${errs > 1 ? 's' : ''}` : `ACME OK${r.start != null ? '' : ''}`, !!errs || !!r.missing);
    if (tab === App.active) { applyMarkers(tab); refreshPanels(); updateHint(); }
    renderTabs();
    return r;
  }

  function acmeHint(msg) { return HelpContent.acmeHints.find(h => h[0].test(msg)) || null; }

  function setAcmeStatus(text, bad) {
    const el = document.getElementById('stAcme');
    el.textContent = text;
    el.classList.toggle('bad', !!bad);
  }

  // all problems of a tab, merged and sorted
  function problemsOf(tab) {
    if (!tab) return [];
    const live = tab.diags;
    const lineHasLive = new Set(live.filter(d => d.severity !== 'info').map(d => d.file + ':' + d.line));
    const acme = (tab.acmeVersion === tab.version ? tab.acmeDiags : tab.acmeDiags.filter(d => d.severity === 'error')).filter(d => !lineHasLive.has(d.file + ':' + d.line));
    const rank = { error: 0, warning: 1, info: 2 };
    return live.concat(acme, tab.sanity).sort((a, b) => (a.file === mainId(tab) ? 0 : 1) - (b.file === mainId(tab) ? 0 : 1) || rank[a.severity] - rank[b.severity] || a.line - b.line);
  }

  function applyMarkers(tab) {
    const s = tab.session;
    for (const id of tab.markerIds) s.removeMarker(id);
    tab.markerIds = [];
    const ann = [];
    const main = mainId(tab);
    const lines = s.getLength();
    for (const d of problemsOf(tab)) {
      if (d.file !== main || d.line >= lines) continue;
      const lineText = s.getLine(d.line);
      let col = d.col || 0, end = d.endCol || 0;
      if (d.source === 'acme' || d.source === 'sanity' || end <= col + 1) { const m = lineText.match(/^\s*/); col = m ? m[0].length : 0; end = Math.max(col + 1, lineText.replace(/\s*;.*$/, '').length); }
      const cls = d.severity === 'error' ? 'acme-err-marker' : d.severity === 'warning' ? 'acme-warn-marker' : 'acme-info-marker';
      tab.markerIds.push(s.addMarker(new Range(d.line, col, d.line, end), cls, 'text', false));
      if (d.severity === 'error') tab.markerIds.push(s.addMarker(new Range(d.line, 0, d.line, 1), 'acme-line-error', 'fullLine', false));
      ann.push({ row: d.line, column: col, text: d.message + (d.hint ? '\nFix: ' + d.hint : ''), type: d.severity === 'info' ? 'info' : d.severity });
    }
    s.setAnnotations(ann);
  }

  // ======================================================= panels
  function refreshPanels() {
    renderProblems();
    renderMemMap();
  }

  function renderProblems() {
    const tab = App.active;
    const panel = document.getElementById('panel-problems');
    const list = problemsOf(tab);
    const errs = list.filter(d => d.severity === 'error').length;
    const cnt = document.getElementById('problemCount');
    cnt.textContent = list.length ? String(list.length) : '';
    cnt.classList.toggle('has-err', errs > 0);
    panel.innerHTML = '';
    if (!tab) return;
    if (!list.length) { panel.appendChild(UI.el('p', { class: 'empty-note', text: 'No problems found. Shift+F7 runs a deeper sanity check.' })); return; }
    const ul = UI.el('ul', { class: 'problems' });
    for (const d of list.slice(0, 400)) {
      const sev = d.severity === 'error' ? 'x' : d.severity === 'warning' ? '!' : 'i';
      const where = (d.file !== mainId(tab) ? P.basename(d.file) + ':' : '') + 'L' + (d.line + 1);
      const src = d.source === 'acme' ? 'ACME' : d.source === 'sanity' ? 'sanity check' : '';
      const li = UI.el('li', { title: 'Go to line' },
        UI.el('span', { class: 'sev sev-' + d.severity, text: sev }),
        UI.el('span', { class: 'where', text: where }),
        UI.el('span', { class: 'msg' }, d.message, src ? UI.el('span', { class: 'src', text: src }) : null,
          d.explain ? UI.el('span', { class: 'fix', text: d.explain }) : null,
          d.hint ? UI.el('span', { class: 'fix', text: 'Fix: ' + d.hint }) : null));
      li.addEventListener('click', () => jumpTo(d.file, d.line, d.col));
      ul.appendChild(li);
    }
    panel.appendChild(ul);
  }

  function renderMemMap() {
    const tab = App.active;
    const panel = document.getElementById('panel-memmap');
    if (!tab || !tab.result) { panel.innerHTML = ''; MemMap.render(panel, { ranges: [] }, {}); return; }
    const info = MemMap.render(panel, tab.result, { onJump: jumpTo });
    const st = document.getElementById('stRange');
    st.textContent = info.blocks.length ? `${UI.hex(info.blocks[0].start, 4)}-${UI.hex(info.blocks[info.blocks.length - 1].end - 1, 4)}  ${info.used} bytes` : '';
  }

  function showPanel(name) {
    const bottom = document.getElementById('bottom');
    bottom.classList.remove('collapsed');
    for (const b of document.querySelectorAll('.btab')) b.classList.toggle('active', b.dataset.panel === name);
    for (const p of document.querySelectorAll('#bottom .panel')) p.classList.toggle('hidden', p.id !== 'panel-' + name);
    setTimeout(() => App.editor.resize(), 10);
  }

  function togglePanel(name) {
    const bottom = document.getElementById('bottom');
    const activeBtn = document.querySelector('.btab.active');
    if (!bottom.classList.contains('collapsed') && activeBtn && activeBtn.dataset.panel === name) bottom.classList.add('collapsed');
    else showPanel(name);
    setTimeout(() => App.editor.resize(), 10);
  }

  function setupResize() {
    const handle = document.getElementById('bottomResize');
    const bottom = document.getElementById('bottom');
    let startY = 0, startH = 0;
    const move = (e) => {
      const h = Math.max(90, Math.min(window.innerHeight - 220, startH + (startY - e.clientY)));
      bottom.style.height = h + 'px';
      App.editor.resize();
    };
    handle.addEventListener('mousedown', (e) => {
      startY = e.clientY; startH = bottom.getBoundingClientRect().height;
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', () => document.removeEventListener('mousemove', move), { once: true });
      e.preventDefault();
    });
  }

  function logOutput(text, cls) {
    const pre = document.getElementById('outputLog');
    const time = new Date().toLocaleTimeString();
    pre.appendChild(UI.el('span', { class: 'dim', text: `[${time}] ` }));
    pre.appendChild(UI.el('span', { class: cls || '', text: text + '\n' }));
    pre.parentElement.scrollTop = pre.parentElement.scrollHeight;
  }
  App.log = logOutput;

  async function jumpTo(file, line, col) {
    const tab = App.active;
    if (!tab) return;
    if (file && file !== mainId(tab) && P.isAbs(file)) {
      const t = await openPath(file);
      if (!t) return;
    }
    App.editor.gotoLine((line || 0) + 1, col || 0, false);
    App.editor.scrollToLine(line || 0, true, false, () => {});
    App.editor.focus();
  }
  App.jumpTo = jumpTo;

  // ======================================================= status & hint
  function currentLineInfo() {
    const tab = App.active;
    if (!tab || !tab.result || !tab.result.lineInfo) return null;
    const row = App.editor.getCursorPosition().row;
    for (let r = row; r >= Math.max(0, row - 60); r--) {
      const i = tab.result.lineInfo.get(r);
      if (i) return Object.assign({ exact: r === row }, i);
    }
    return null;
  }

  function updateStatus() {
    const tab = App.active;
    const pos = App.editor.getCursorPosition();
    document.getElementById('stPos').textContent = tab ? `Ln ${pos.row + 1}, Col ${pos.column + 1}` : '';
    const li = tab ? currentLineInfo() : null;
    document.getElementById('stAddr').textContent = li ? (li.exact ? '' : 'near ') + UI.hex(li.addr, 4) + (li.pc !== li.addr ? ` (runs at ${UI.hex(li.pc, 4)})` : '') : (tab ? '$----' : '');
    const sel = App.editor.getSelectedText();
    document.getElementById('stSel').textContent = tab && sel ? `${sel.length} selected` : '';
    document.getElementById('stFile').textContent = tab ? (tab.path || (tab.exampleBase ? 'example (not saved)' : 'not saved')) : '';
  }

  function diagsAt(row, col) {
    const tab = App.active;
    if (!tab) return [];
    const main = mainId(tab);
    return problemsOf(tab).filter(d => d.file === main && d.line === row && (col == null || d.source === 'acme' || (col >= (d.col || 0) - 1 && col <= (d.endCol || 999) + 1)));
  }

  function updateHint() {
    const bar = document.getElementById('hintBar');
    const icon = bar.querySelector('.hint-icon'), text = bar.querySelector('.hint-text'), fix = bar.querySelector('.hint-fix');
    bar.className = 'hint-bar';
    const tab = App.active;
    if (!tab) { icon.textContent = ''; text.textContent = 'Ready.'; fix.textContent = ''; return; }
    const pos = App.editor.getCursorPosition();
    const ds = diagsAt(pos.row, null);
    if (ds.length) {
      const d = ds[0];
      bar.classList.add('is-' + d.severity);
      icon.textContent = d.severity === 'error' ? 'Error' : d.severity === 'warning' ? 'Warning' : 'Note';
      text.textContent = d.message + (d.explain ? ' ' + d.explain : '') + (ds.length > 1 ? `  (+${ds.length - 1} more)` : '');
      fix.textContent = d.hint || '';
      return;
    }
    // context help for the instruction on this line
    bar.classList.add('is-help');
    icon.textContent = '';
    fix.textContent = '';
    const instr = tab.result && tab.result.instrs ? tab.result.instrs.find(i => i.loc.line === pos.row && i.loc.file === mainId(tab)) : null;
    if (instr) {
      const d = O.ALL[instr.mn]; const m = d.modes[instr.mode];
      text.textContent = `${UI.hex(instr.addr, 4)}  ${instr.mn} - ${d.title}  |  ${O.MODES[instr.mode].name}, opcode $${m[0].toString(16).padStart(2, '0')}, ${instr.size} byte${instr.size > 1 ? 's' : ''}, ${m[1]}${m[2] ? '+' : ''} cycles  |  flags: ${d.flags || 'none'}`;
      return;
    }
    const tok = tab.session.getTokenAt(pos.row, pos.column) || tab.session.getTokenAt(pos.row, pos.column + 1);
    if (tok && /pseudo/.test(tok.type)) {
      const c = O.canonicalPseudo(tok.value);
      if (c) { text.textContent = `${c} ${O.PSEUDO[c].args} - ${O.PSEUDO[c].desc}`; return; }
    }
    const errs = problemsOf(tab).filter(d => d.severity === 'error' && d.file === mainId(tab));
    text.textContent = errs.length ? `${errs.length} error${errs.length > 1 ? 's' : ''} in this file - see Problems (Ctrl+J). First one in line ${errs[0].line + 1}.` : 'No errors. Hover over numbers, labels and mnemonics for details. F5 = run in VICE.';
  }

  // ============================================================ hover
  let hoverTimer = null;
  function onEditorHover(e) {
    clearTimeout(hoverTimer);
    const x = e.domEvent.clientX, y = e.domEvent.clientY;
    hoverTimer = setTimeout(() => {
      const tab = App.active;
      if (!tab) return;
      const pos = e.getDocumentPosition();
      const screen = App.editor.renderer.textToScreenCoordinates(pos.row, pos.column);
      if (Math.abs(screen.pageY - y) > App.editor.renderer.lineHeight * 1.5) { UI.hideTip(); return; }
      const html = hoverHtml(tab, pos);
      if (html) UI.showTip(html, x, y); else UI.hideTip();
    }, 280);
  }

  function hoverHtml(tab, pos) {
    let html = '';
    for (const d of diagsAt(pos.row, pos.column)) {
      html += `<div class="${d.severity === 'error' ? 'tt-err' : d.severity === 'warning' ? 'tt-warn' : ''}"><b>${d.severity === 'error' ? 'Error' : d.severity === 'warning' ? 'Warning' : 'Note'}${d.source === 'acme' ? ' (ACME)' : ''}:</b> ${UI.esc(d.message)}</div>${d.explain ? `<div>${UI.esc(d.explain)}</div>` : ''}${d.hint ? `<div class="tt-fix">Fix: ${UI.esc(d.hint)}</div>` : ''}`;
    }
    const tok = tab.session.getTokenAt(pos.row, pos.column + 1);
    if (tok) {
      const t = tok.type, v = tok.value;
      if (/numeric/.test(t)) html += numberHtml(UI.parseNum(v.replace(/^&/, '0o')) , v);
      else if (/mnemonic|illegal/.test(t)) {
        const mn = v.replace(/\+\d$/, '').toUpperCase(); const d = O.ALL[mn];
        if (d) {
          html += `${html ? '<hr>' : ''}<b>${mn}</b> - ${UI.esc(d.title)}<br><span class="muted">${UI.esc(d.desc)}</span><br>Flags: ${d.flags || 'none'}`;
          const instr = tab.result && tab.result.instrs.find(i => i.loc.line === pos.row && i.loc.file === mainId(tab));
          if (instr) { const m = d.modes[instr.mode]; html += `<br>${O.MODES[instr.mode].name}: $${m[0].toString(16).padStart(2, '0')}, ${instr.size} bytes, ${m[1]} cycles${m[2] === 'p' ? ' (+1 page cross)' : m[2] === 'b' ? ' (+1 taken, +2 page)' : ''}<br>Address: ${UI.hex(instr.addr, 4)}`; }
          html += '<br><span class="muted">Ctrl+F1: reference page</span>';
        }
      } else if (/pseudo/.test(t)) {
        const c = O.canonicalPseudo(v);
        if (c) html += `<b>${c}</b> ${UI.esc(O.PSEUDO[c].args)}<br><span class="muted">${UI.esc(O.PSEUDO[c].desc)}</span>`;
      } else if (/identifier|label|local|macro/.test(t) && tab.result) {
        const name = v.replace(/^\+/, '');
        const sym = lookupSymbol(tab, name, pos.row);
        if (sym) {
          html += `${html ? '<hr>' : ''}<b>${UI.esc(name)}</b> = ${UI.hex(sym.v, sym.v > 255 ? 4 : 2)} <span class="muted">(${sym.v})</span>`;
          const info = ADDR_INFO.get(sym.v);
          if (info) html += `<br>${UI.esc(info.name)}${info.desc ? '<br><span class="muted">' + UI.esc(info.desc) + '</span>' : ''}`;
          else if (sym.v > 255) html += `<br><span class="muted">${UI.esc(MemMap.areaOf(sym.v))}</span>`;
          if (sym.loc) html += `<br><span class="muted">defined in line ${sym.loc.line + 1}</span>`;
        } else if (/macro/.test(t)) html += `<b>+${UI.esc(name)}</b> macro call`;
      }
    }
    return html;
  }

  function numberHtml(v, raw) {
    if (isNaN(v)) return '';
    let h = `<b>${UI.esc(raw)}</b><table><tr><td class="muted">hex</td><td>${UI.hex(v, v > 255 ? 4 : 2)}</td></tr><tr><td class="muted">dec</td><td>${v}</td></tr><tr><td class="muted">bin</td><td>%${v.toString(2).padStart(v > 255 ? 16 : 8, '0').replace(/(\d{8})(?=\d)/, '$1 ')}</td></tr>`;
    if (v < 256 && v > 127) h += `<tr><td class="muted">signed</td><td>${v - 256}</td></tr>`;
    h += '</table>';
    const info = ADDR_INFO.get(v);
    if (info) h += `${UI.esc(info.name)}${info.desc ? '<br><span class="muted">' + UI.esc(info.desc) + '</span>' : ''}`;
    else if (v > 255 && v <= 0xffff) h += `<span class="muted">${UI.esc(MemMap.areaOf(v))}</span>`;
    return h;
  }

  function lookupSymbol(tab, name, row) {
    const map = tab.result.symbolMap;
    if (!map) return null;
    if (map.has(name)) return map.get(name);
    for (const [k, s] of map) if (k.endsWith(':' + name)) return s;   // local symbol (first match)
    void row;
    return null;
  }

  // ======================================================== completion
  function setupCompletion() {
    const langTools = ace.require('ace/ext/language_tools');
    const mnItems = O.mnemonicList().map(m => ({ caption: m.toLowerCase(), value: m.toLowerCase(), meta: O.LEGAL[m].title, score: 100 }));
    const illItems = O.illegalList().map(m => ({ caption: m.toLowerCase(), value: m.toLowerCase(), meta: 'illegal: ' + O.ILLEGAL[m].title, score: 40 }));
    const poItems = O.pseudoList().map(p => ({ caption: p, value: p, meta: 'ACME', score: 90 }));
    const snippets = [
      { caption: 'basic-upstart', snippet: '* = \\$0801\n        !word +, 10\n        !byte \\$9e\n        !text "2061"\n        !byte 0\n+       !word 0\n${1:start}\n', meta: 'template' },
      { caption: 'irq-setup', snippet: 'sei\n        lda #\\$7f\n        sta \\$dc0d\n        lda \\$dc0d\n        lda #<${1:irq}\n        sta \\$0314\n        lda #>${1:irq}\n        sta \\$0315\n        lda #${2:\\$80}\n        sta \\$d012\n        lda \\$d011\n        and #\\$7f\n        sta \\$d011\n        lda #1\n        sta \\$d01a\n        cli\n', meta: 'template' },
      { caption: 'loop-x', snippet: 'ldx #0\n-       lda ${1:source},x\n        sta ${2:\\$0400},x\n        inx\n        cpx #${3:40}\n        bne -\n', meta: 'template' },
      { caption: 'wait-raster', snippet: '-       lda \\$d012\n        cmp #${1:\\$ff}\n        bne -\n', meta: 'template' }
    ];
    const completer = {
      identifierRegexps: [/[a-zA-Z_0-9.!@\u00c0-\uffff]/],
      getCompletions(editor, session, pos, prefix, cb) {
        if (!prefix) return cb(null, []);
        const line = session.getLine(pos.row).slice(0, pos.column);
        if (/;/.test(line.replace(/"[^"]*"/g, ''))) return cb(null, []);        // inside a comment
        if ((line.match(/"/g) || []).length % 2) return cb(null, []);           // inside a string
        const low = prefix.toLowerCase();
        let items = [];
        if (prefix[0] === '!') items = poItems.slice();
        else {
          const tab = App.active;
          const atStart = /^\S*$/.test(line);
          if (!atStart || line.match(/^\s/)) items = items.concat(mnItems, illItems);
          items = items.concat(snippets.map(s => Object.assign({ score: 30 }, s)));
          if (tab && tab.result) {
            for (const s of tab.result.symbols) items.push({ caption: s.name, value: s.name, meta: UI.hex(s.value || 0, (s.value || 0) > 255 ? 4 : 2), score: 80 });
          }
        }
        items = items.filter(i => i.caption.toLowerCase() !== low);
        cb(null, items);
      },
      getDocTooltip(item) {
        const mn = item.caption && O.ALL[item.caption.toUpperCase()];
        if (mn && !item.docHTML) item.docHTML = `<b>${item.caption.toUpperCase()}</b> - ${UI.esc(mn.title)}<br>${UI.esc(mn.desc)}`;
        const po = item.caption && O.canonicalPseudo(item.caption);
        if (po && !item.docHTML) item.docHTML = `<b>${po}</b> ${UI.esc(O.PSEUDO[po].args)}<br>${UI.esc(O.PSEUDO[po].desc)}`;
      }
    };
    langTools.setCompleters([completer]);
    App.editor.setOptions({ enableBasicAutocompletion: true, enableLiveAutocompletion: App.settings.autocomplete !== false, enableSnippets: true, liveAutocompletionThreshold: 2 });
  }

  // =========================================================== editing
  function changeMnemonicCase(upper) {
    const s = App.active.session;
    const out = [];
    for (let row = 0; row < s.getLength(); row++) {
      out.push(s.getTokens(row).map(t => (/mnemonic|illegal/.test(t.type) ? (upper ? t.value.toUpperCase() : t.value.toLowerCase()) : t.value)).join(''));
    }
    replaceAll(out.join(s.getDocument().getNewLineCharacter()));
  }

  function replaceAll(text) {
    const ed = App.editor;
    const pos = ed.getCursorPosition();
    const s = ed.session;
    if (s.getValue() === text) return;
    s.replace(new Range(0, 0, s.getLength(), Infinity), text);
    ed.moveCursorToPosition(pos);
    ed.clearSelection();
  }

  // Tidy: labels in column 1, statements at column 8 (keeps deeper
  // indentation of blocks), comments aligned at column 40
  function tidy() {
    const s = App.active.session;
    const lines = s.getValue().split(/\r?\n/);
    const out = lines.map(line => {
      if (!line.trim()) return '';
      if (/^\s*;/.test(line)) return line.replace(/\s+$/, '');
      let code = line, comment = '';
      let inStr = null;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inStr) { if (c === inStr) inStr = null; continue; }
        if (c === '"' || c === "'") { inStr = c; continue; }
        if (c === ';') { code = line.slice(0, i); comment = line.slice(i); break; }
      }
      code = code.replace(/\s+$/, '');
      const indent = (code.match(/^[ \t]*/)[0]).replace(/\t/g, '        ').length;
      let label = '', stmt = code.trim();
      if (indent === 0) {
        const m = code.match(/^(\S+)\s*(.*)$/);
        const first = m[1];
        const isStmt = O.isAnyMnemonic(first.replace(/\+\d$/, '')) || first.startsWith('!') || first.startsWith('*') || /^\+[A-Za-z]/.test(first) || /=/.test(m[2].slice(0, 1)) || first.includes('=') || first === '}' || first.startsWith('}');
        if (!isStmt) { label = first; stmt = m[2]; }
        if (/^[^=]*=/.test(code) && !first.startsWith('!')) { label = ''; stmt = code.trim(); return stmt + (comment ? pad(stmt, 40) + comment : ''); }
      }
      let res;
      if (label) res = stmt ? label + pad(label, 8) + stmt : label;
      else res = ' '.repeat(Math.max(8, Math.round(indent / 4) * 4)) + stmt;
      if (comment) res += pad(res, 40) + comment;
      return res.replace(/\s+$/, '');
    });
    replaceAll(out.join('\n'));
    UI.toast('Columns tidied up (Ctrl+Z to undo).', 'ok');
  }
  function pad(s, col) { return s.length < col ? ' '.repeat(col - s.length) : ' '; }

  // ========================================================== templates
  const TEMPLATES = {
    basic: `; ---- BASIC start line: 10 SYS 2061 ----
        * = $0801
        !word +, 10             ; pointer to the next BASIC line, line number
        !byte $9e               ; SYS
        !text "2061"            ; = $080d, the address of "start"
        !byte 0
+       !word 0                 ; end of BASIC
start
`,
    irq: `; ---- raster interrupt setup ----
        sei
        lda #$7f
        sta $dc0d               ; CIA 1 timer IRQ off
        lda $dc0d               ; acknowledge pending CIA IRQs
        lda #<irq
        sta $0314
        lda #>irq
        sta $0315
        lda #$80                ; raster line
        sta $d012
        lda $d011
        and #$7f                ; bit 8 of the raster line = 0
        sta $d011
        lda #$01
        sta $d01a               ; enable raster IRQ
        cli
        rts

irq     lda #$ff
        sta $d019               ; acknowledge the IRQ
        inc $d020               ; your code here
        dec $d020
        jmp $ea31               ; KERNAL IRQ (keyboard etc.)
`,
    sprite: `; ---- sprite data (24 x 21 pixels, 64 bytes, must be 64-byte aligned) ----
        !align 63, 0
sprite_data
${Array.from({ length: 21 }, () => '        !byte %........,%........,%........').join('\n')}
        !byte 0                 ; padding to 64 bytes
`,
    macro: `!macro name .param {
        lda #.param
        sta $d020
}
        ; call it with:  +name 2
`
  };

  async function insertFileTemplate(kind) {
    const tab = App.active; if (!tab) return;
    const filters = kind === 'sid' ? [{ name: 'SID music', extensions: ['sid'] }] : kind === 'kla' ? [{ name: 'Koala picture', extensions: ['kla', 'koa'] }] : [{ name: 'All files', extensions: ['*'] }];
    const files = await api.openDialog({ title: 'Choose a file to include', filters });
    if (!files) return;
    const file = files[0];
    const base = tab.path ? P.dirname(tab.path) : tab.baseDir;
    let rel = P.relative(base, file);
    if (rel.startsWith('../../..')) rel = file.replace(/\\/g, '/');
    let text = '';
    if (kind === 'sid') {
      const h = await api.sidInfo(file);
      if (!h) { UI.toast('This is not a PSID/RSID file.', 'err'); return; }
      text = `; ---- SID: "${h.name}" by ${h.author} (${h.released}) ----
; load ${UI.hex(h.loadAddress, 4)}-${UI.hex(h.endAddress, 4)}, init ${UI.hex(h.initAddress, 4)}, play ${UI.hex(h.playAddress, 4)}, ${h.songs} song(s)
MUSIC_INIT = ${UI.hex(h.initAddress, 4)}
MUSIC_PLAY = ${UI.hex(h.playAddress, 4)}
        * = ${UI.hex(h.loadAddress, 4)}
music   !bin "${rel}",, ${UI.hex(h.skip, 2)}
; start:  lda #0 : jsr MUSIC_INIT     each frame:  jsr MUSIC_PLAY
`;
    } else if (kind === 'kla') {
      text = `; ---- Koala picture: bitmap $6000, screen $7f40, colours $8328, bg $8710 ----
        * = $6000
picture !bin "${rel}",, 2       ; skip the 2-byte load address
`;
    } else {
      const st = await api.stat(file);
      text = `binary  !bin "${rel}"             ; ${st ? st.size + ' bytes' : ''}\n`;
    }
    App.editor.insert(text);
    App.editor.focus();
  }

  // ============================================================ building
  function outputName(tab) {
    const o = tab.result && tab.result.outputs && tab.result.outputs[0];
    if (o && o.name) return o.name;
    return P.stem(tab.title || 'program') + '.prg';
  }

  function showBuildErrors(tab, r) {
    const errs = (r.diags || []).filter(d => d.severity === 'error');
    if (!errs.length) return;
    showPanel('problems');
    const first = errs[0];
    if (first.file === (tab.path || 'untitled')) jumpTo(mainId(tab), first.line, 0);
  }

  async function assembleTab(tab, opts) {
    if (!tab) return null;
    const r = await api.assemble(Object.assign({ source: tab.session.getValue(), docPath: tab.path, baseDir: tab.baseDir }, opts || {}));
    if (r.missing) { UI.toast('ACME was not found. Open Settings > Tools to set its path.', 'err'); logOutput(r.log, 'err'); return null; }
    logOutput(r.log || '', r.ok ? 'ok' : 'err');
    // update the ACME problems
    const doc = tab.path || 'untitled';
    tab.acmeDiags = r.diags.map(d => {
      const hint = acmeHint(d.message);
      return Object.assign({}, d, { file: (d.file === doc || d.file === tab.path) ? mainId(tab) : d.file, hint: hint ? hint[2] : '', explain: hint ? hint[1] : '', source: 'acme' });
    });
    tab.acmeVersion = tab.version;
    applyMarkers(tab); refreshPanels(); updateHint(); renderTabs();
    const errs = tab.acmeDiags.filter(d => d.severity === 'error').length;
    setAcmeStatus(errs ? `ACME: ${errs} error${errs > 1 ? 's' : ''}` : 'ACME OK', errs > 0);
    if (!r.ok) {
      UI.toast(`ACME found ${errs || 'some'} error${errs === 1 ? '' : 's'} - nothing was built.`, 'err');
      showBuildErrors(tab, r);
      return null;
    }
    return r;
  }

  async function buildRun(packed) {
    const tab = App.active; if (!tab) return;
    const r = await assembleTab(tab, { labels: !!(App.settings.vice && App.settings.vice.monitorLabels) });
    if (!r) return;
    let prg = r.outFile;
    if (packed) {
      const p = await api.pack({ input: r.outFile, output: r.outFile.replace(/\.prg$/i, '') + '_exo.prg', start: packStart(r) });
      logOutput(p.log, p.ok ? 'ok' : 'err');
      if (!p.ok) { UI.toast(p.missing ? 'Exomizer was not found (Settings > Tools).' : 'Exomizer failed - see Output.', 'err'); showPanel('output'); return; }
      prg = r.outFile.replace(/\.prg$/i, '') + '_exo.prg';
    }
    const v = await api.runVice(prg, r.labelFile);
    logOutput(v.log, v.ok ? '' : 'err');
    if (!v.ok) { if (v.missing) { await viceMissing(prg, r.labelFile); return; } UI.toast('Could not start VICE - see Output.', 'err'); showPanel('output'); return; }
    UI.toast(`Running in VICE: ${UI.hex(r.start || 0, 4)}-${UI.hex((r.end || 1) - 1, 4)}${packed ? ' (packed)' : ''}`, 'ok', 2500);
  }

  // start address for Exomizer: "sys" for BASIC programs, else the load address
  function packStart(r, custom) {
    if (custom) return custom;
    const tab = App.active;
    const starts0801 = r && r.start === 0x0801;
    if (starts0801) return 'sys';
    const s = r && r.start != null ? r.start : (tab && tab.result ? tab.result.start : 0x0801);
    return '0x' + (s || 0x0801).toString(16);
  }
  App.packStart = packStart;

  async function buildToFile() {
    const tab = App.active; if (!tab) return;
    if (!tab.path) { UI.toast('Save the source first - the PRG is written next to it.', 'warn'); if (!(await saveTab(tab))) return; }
    const out = P.join(P.dirname(tab.path), outputName(tab));
    const r = await assembleTab(tab, { outFile: out });
    if (r) UI.toast(`Built ${P.basename(out)}: ${UI.hex(r.start, 4)}-${UI.hex(r.end - 1, 4)}, ${r.size} bytes`, 'ok');
  }

  async function check() {
    const tab = App.active; if (!tab) return;
    runAnalysis(tab);
    const r = await runAcme(tab, true);
    if (!r) return;
    const errs = tab.acmeDiags.filter(d => d.severity === 'error').length, warns = tab.acmeDiags.filter(d => d.severity === 'warning').length;
    logOutput(r.log || '', r.ok ? 'ok' : 'err');
    if (errs) { UI.toast(`ACME: ${errs} error${errs > 1 ? 's' : ''}, ${warns} warning${warns === 1 ? '' : 's'}.`, 'err'); showBuildErrors(tab, r); }
    else UI.toast(`ACME: no errors${warns ? ', ' + warns + ' warning' + (warns > 1 ? 's' : '') : ''}. Program ${UI.hex(r.start || 0, 4)}-${UI.hex((r.end || 1) - 1, 4)}, ${r.size || 0} bytes.`, 'ok');
  }

  async function sanityCheck() {
    const tab = App.active; if (!tab) return;
    runAnalysis(tab);
    tab.sanity = C64Analyzer.analyze(tab.result, tab.session.getValue(), mainId(tab));
    await runAcme(tab, true);
    applyMarkers(tab); refreshPanels(); updateHint();
    showPanel('problems');
    const all = problemsOf(tab);
    const c = (s) => all.filter(d => d.severity === s).length;
    const msg = `Sanity check: ${c('error')} error(s), ${c('warning')} warning(s), ${c('info')} note(s).`;
    UI.toast(all.length ? msg : 'Sanity check: everything looks fine!', c('error') ? 'err' : c('warning') ? 'warn' : 'ok', 5000);
    logOutput(msg);
  }

  // ============================================================ commands
  function inTextInput() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || (a.tagName === 'TEXTAREA' && !a.classList.contains('ace_text-input')));
  }

  async function command(cmd, arg) {
    const ed = App.editor, tab = App.active;
    UI.hideTip();
    const needTab = () => { if (!tab) { UI.toast('Open or create a file first.', 'warn'); return false; } return true; };
    if (inTextInput() && ['edit:undo', 'edit:redo', 'edit:selectAll'].includes(cmd)) {
      const a = document.activeElement;
      if (cmd === 'edit:selectAll') a.select && a.select(); else document.execCommand(cmd === 'edit:undo' ? 'undo' : 'redo');
      return;
    }
    switch (cmd) {
      case 'file:new': newTab({ text: '', title: 'untitled' + (App.nextId > 1 ? '-' + App.nextId : '') + '.asm' }); break;
      case 'file:open': {
        const files = await api.openDialog({ title: 'Open source', filters: SOURCE_FILTERS, properties: ['openFile', 'multiSelections'] });
        if (files) for (const f of files) await openPath(f);
        break;
      }
      case 'file:open-path': await openPath(arg); break;
      case 'file:save': if (needTab()) await saveTab(tab); break;
      case 'file:saveAs': if (needTab()) await saveTab(tab, true); break;
      case 'file:saveAll': for (const t of App.tabs) if (t.dirty) await saveTab(t); break;
      case 'file:close': if (tab) await closeTab(tab); break;

      case 'edit:undo': ed.undo(); break;
      case 'edit:redo': ed.redo(); break;
      case 'edit:selectAll': ed.selectAll(); break;
      case 'edit:find': if (Help.isOpen()) { document.querySelector('.help-top input').focus(); break; } ed.execCommand('find'); break;
      case 'edit:replace': ed.execCommand('replace'); break;
      case 'edit:findNext': ed.findNext(); break;
      case 'edit:findPrev': ed.findPrevious(); break;
      case 'edit:gotoLine': {
        if (!needTab()) break;
        const v = await UI.prompt('Go to line', `Line number (1-${ed.session.getLength()}):`, String(ed.getCursorPosition().row + 1));
        if (v && !isNaN(parseInt(v, 10))) { ed.gotoLine(parseInt(v, 10), 0, true); ed.focus(); }
        break;
      }
      case 'edit:upper': ed.execCommand('touppercase'); break;
      case 'edit:lower': ed.execCommand('tolowercase'); break;
      case 'edit:mnemonicsUpper': if (needTab()) changeMnemonicCase(true); break;
      case 'edit:mnemonicsLower': if (needTab()) changeMnemonicCase(false); break;
      case 'edit:comment': ed.execCommand('togglecomment'); break;
      case 'edit:duplicate': ed.execCommand('duplicateSelection'); break;
      case 'edit:tidy': if (needTab()) tidy(); break;

      case 'insert:basic': case 'insert:irq': case 'insert:sprite': case 'insert:macro':
        if (needTab()) { ed.insert(TEMPLATES[cmd.split(':')[1]]); ed.focus(); }
        break;
      case 'insert:sid': case 'insert:kla': case 'insert:bin': if (needTab()) await insertFileTemplate(cmd.split(':')[1]); break;

      case 'build:check': if (needTab()) await check(); break;
      case 'build:analyze': if (needTab()) await sanityCheck(); break;
      case 'build:build': if (needTab()) await buildToFile(); break;
      case 'build:savePrg': if (needTab()) await Dialogs.savePrg(); break;
      case 'build:run': if (needTab()) await buildRun(false); break;
      case 'build:runPacked': if (needTab()) await buildRun(true); break;

      case 'tools:converter': Converter.toggle(); break;
      case 'tools:sidreloc': await Dialogs.sidReloc(); break;
      case 'tools:sidinfo': await Dialogs.sidInfo(); break;
      case 'tools:exomizer': await Dialogs.packFile(); break;
      case 'vice:runFile': {
        const f = await api.openDialog({ title: 'Run a PRG in VICE', filters: [{ name: 'C64 programs', extensions: ['prg', 'd64', 't64', 'crt', 'p00'] }] });
        if (f) { const v = await api.runVice(f[0], null); logOutput(v.log, v.ok ? '' : 'err'); if (!v.ok) { if (v.missing) await viceMissing(f[0], null); else UI.toast('Could not start VICE - see Output.', 'err'); } }
        break;
      }
      case 'vice:start': { const v = await api.runVice(null, null); logOutput(v.log, v.ok ? '' : 'err'); if (!v.ok) { if (v.missing) await viceMissing(null, null); else UI.toast('Could not start VICE - see Output.', 'err'); } break; }
      case 'settings:open': await Dialogs.settings(arg); break;

      case 'examples:gallery': await Dialogs.examples(); break;
      case 'example:open': await openExample(arg); break;

      case 'view:theme': applyTheme(App.settings.theme === 'day' ? 'night' : 'day', true); break;
      case 'view:memmap': togglePanel('memmap'); break;
      case 'view:problems': togglePanel('problems'); break;
      case 'view:bottom': document.getElementById('bottom').classList.toggle('collapsed'); setTimeout(() => ed.resize(), 10); break;
      case 'view:wrap': App.settings.wordWrap = !App.settings.wordWrap; for (const t of App.tabs) t.session.setUseWrapMode(App.settings.wordWrap); api.setSettings({ wordWrap: App.settings.wordWrap }); break;
      case 'view:invisibles': App.settings.showInvisibles = !App.settings.showInvisibles; ed.setShowInvisibles(App.settings.showInvisibles); api.setSettings({ showInvisibles: App.settings.showInvisibles }); break;
      case 'view:zoomIn': setFontSize(App.settings.fontSize + 1); break;
      case 'view:zoomOut': setFontSize(App.settings.fontSize - 1); break;
      case 'view:zoomReset': setFontSize(15); break;

      case 'help:open': Help.show(arg || 'welcome'); break;
      case 'help:context': {
        if (!tab) { Help.show('welcome'); break; }
        const pos = ed.getCursorPosition();
        const tok = tab.session.getTokenAt(pos.row, pos.column) || tab.session.getTokenAt(pos.row, pos.column + 1);
        const word = ed.getSelectedText() || (tok ? tok.value.replace(/\+\d$/, '') : '');
        Help.forWord(word);
        break;
      }
      case 'help:about': await Dialogs.about(); break;
      default: console.warn('unknown command', cmd);
    }
  }
  App.command = command;

  function setFontSize(n) {
    n = Math.max(9, Math.min(36, n));
    App.settings.fontSize = n;
    App.editor.setFontSize(n);
    api.setSettings({ fontSize: n });
  }

  App.applySettings = (s) => {
    App.settings = s;
    const ed = App.editor;
    ed.setFontSize(s.fontSize);
    ed.setOptions({ enableLiveAutocompletion: s.autocomplete !== false });
    for (const t of App.tabs) { t.session.setTabSize(s.tabSize || 8); t.session.setUseSoftTabs(s.useSoftTabs !== false); t.session.setUseWrapMode(!!s.wordWrap); }
    ed.setShowInvisibles(!!s.showInvisibles);
    applyTheme(s.theme, false);
    refreshToolState();
  };
  App.addrInfo = ADDR_INFO;
  App.focusEditor = () => { if (App.active) App.editor.focus(); };
  App.assembleTab = assembleTab;
  App.outputName = outputName;
  App.saveTab = saveTab;
  App.openExample = openExample;
  App.refreshToolState = refreshToolState;
  App.showPanel = showPanel;

  window.addEventListener('DOMContentLoaded', init);
  window.addEventListener('resize', () => App.editor && App.editor.resize());
})();
