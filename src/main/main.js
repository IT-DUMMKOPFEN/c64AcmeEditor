/*
 * C64 ACME EDITOR - Electron main process
 * (c) IT-Dummköpfe - MIT License
 */
'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, nativeTheme } = require('electron');
const fs = require('fs');
const path = require('path');
const { Settings } = require('./settings.js');
const { Tools } = require('./tools.js');
const Asm = require('../renderer/js/assembler.js');

const APP_NAME = 'C64 ACME EDITOR';
const APP_VERSION = '0.3b';
const APP_AUTHOR = 'IT-Dummköpfe';

app.setName(APP_NAME);

let win = null;
let settings = null;
let tools = null;
let forceClose = false;
const pendingOpen = [];

function resourcePath(...p) {
  return app.isPackaged ? path.join(process.resourcesPath, ...p) : path.join(__dirname, '..', '..', ...p);
}
const EXAMPLES_DIR = () => resourcePath('examples');
const SNIPPETS_DIR = () => resourcePath('snippets');

// ------------------------------------------------------------------ window
function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: `${APP_NAME} ${APP_VERSION}`,
    backgroundColor: settings.get().theme === 'day' ? '#f4f1e8' : '#14161f',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  if (process.env.C64AE_AUTOTEST) {
    win.webContents.on('console-message', (e) => console.log('[renderer]', e.message, e.sourceId ? String(e.sourceId).split('/').pop() + ':' + e.lineNumber : ''));
  }
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
    if (process.env.C64AE_AUTOTEST) runAutotest(process.env.C64AE_AUTOTEST);
  });
  win.on('close', (e) => {
    if (forceClose) return;
    e.preventDefault();
    win.webContents.send('app:request-close');
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
  buildMenu();
}

// Developer/CI self test: C64AE_AUTOTEST=steps.json runs JavaScript steps in
// the UI and stores screenshots. Not used in normal operation.
async function runAutotest(file) {
  const steps = JSON.parse(fs.readFileSync(file, 'utf8'));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  await sleep(1500);
  for (const st of steps) {
    try {
      if (st.js) {
        const r = await win.webContents.executeJavaScript(st.js, true);
        if (st.log) console.log('[autotest]', st.log, JSON.stringify(r));
      }
      if (st.wait) await sleep(st.wait);
      if (st.shot) {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(st.shot, img.toPNG());
        console.log('[autotest] screenshot', st.shot);
      }
    } catch (e) { console.log('[autotest] step failed', e.message); }
  }
  forceClose = true;
  app.exit(0);
}

// -------------------------------------------------------------------- menu
function send(cmd, arg) { if (win) win.webContents.send('menu', cmd, arg); }

function exampleMenu() {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(path.join(EXAMPLES_DIR(), 'index.json'), 'utf8')); } catch (e) { /* ignore */ }
  const items = list.map(ex => ({ label: ex.title + '  (' + ex.level + ')', click: () => send('example:open', ex.file) }));
  items.push({ type: 'separator' }, { label: 'Example Gallery…', accelerator: 'CmdOrCtrl+Shift+E', click: () => send('examples:gallery') },
    { label: 'Snippet Library…', click: () => send('snippets:open') });
  return items;
}

function recentMenu() {
  const rec = settings.get().recentFiles || [];
  if (!rec.length) return [{ label: '(empty)', enabled: false }];
  return rec.map(f => ({ label: f, click: () => send('file:open-path', f) })).concat([{ type: 'separator' }, { label: 'Clear Recent', click: () => { settings.set({ recentFiles: [] }); settings.data.recentFiles = []; settings.save(); buildMenu(); } }]);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: APP_NAME,
      submenu: [
        { label: `About ${APP_NAME}`, click: () => send('help:about') },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'Cmd+,', click: () => send('settings:open') },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Cmd+Q', click: () => win && win.close() }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => send('file:new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => send('file:open') },
        { label: 'Open Recent', submenu: recentMenu() },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('file:save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('file:saveAs') },
        { label: 'Save All', accelerator: 'CmdOrCtrl+Alt+S', click: () => send('file:saveAll') },
        { label: 'Save as PRG…', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('build:savePrg') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => send('file:close') },
        ...(isMac ? [] : [
          { type: 'separator' },
          { label: 'Settings…', accelerator: 'Ctrl+,', click: () => send('settings:open') },
          { type: 'separator' },
          { label: 'Exit', accelerator: 'Alt+F4', click: () => win && win.close() }
        ])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => send('edit:undo') },
        { label: 'Redo', accelerator: isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y', click: () => send('edit:redo') },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => send('edit:selectAll') },
        { type: 'separator' },
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: () => send('edit:find') },
        { label: 'Replace…', accelerator: 'CmdOrCtrl+H', click: () => send('edit:replace') },
        { label: 'Find Next', accelerator: 'F3', click: () => send('edit:findNext') },
        { label: 'Find Previous', accelerator: 'Shift+F3', click: () => send('edit:findPrev') },
        { label: 'Go to Line…', accelerator: 'CmdOrCtrl+G', click: () => send('edit:gotoLine') },
        { type: 'separator' },
        { label: 'UPPERCASE Selection', accelerator: 'CmdOrCtrl+Shift+U', click: () => send('edit:upper') },
        { label: 'lowercase Selection', accelerator: 'CmdOrCtrl+Shift+L', click: () => send('edit:lower') },
        { label: 'Mnemonics to UPPERCASE (whole file)', click: () => send('edit:mnemonicsUpper') },
        { label: 'Mnemonics to lowercase (whole file)', click: () => send('edit:mnemonicsLower') },
        { type: 'separator' },
        { label: 'Toggle Comment', accelerator: 'CmdOrCtrl+/', click: () => send('edit:comment') },
        { label: 'Duplicate Line', accelerator: 'CmdOrCtrl+D', click: () => send('edit:duplicate') },
        { label: 'Tidy Up Columns (labels / code / comments)', accelerator: 'CmdOrCtrl+Shift+F', click: () => send('edit:tidy') },
        { type: 'separator' },
        { label: 'Insert', submenu: [
          { label: 'Snippet Library…', accelerator: 'CmdOrCtrl+I', click: () => send('snippets:open') },
          { type: 'separator' },
          { label: 'BASIC Start Line (10 SYS 2061)', click: () => send('insert:basic') },
          { label: 'Raster IRQ Skeleton', click: () => send('insert:irq') },
          { label: 'SID Music Include…', click: () => send('insert:sid') },
          { label: 'Koala Picture Include…', click: () => send('insert:kla') },
          { label: 'Binary File Include…', click: () => send('insert:bin') },
          { label: 'Sprite Data Template', click: () => send('insert:sprite') },
          { label: 'Macro Template', click: () => send('insert:macro') }
        ] }
      ]
    },
    {
      label: 'Build',
      submenu: [
        { label: 'Check with ACME', accelerator: 'F7', click: () => send('build:check') },
        { label: 'Sanity Check (logic analysis)', accelerator: 'Shift+F7', click: () => send('build:analyze') },
        { type: 'separator' },
        { label: 'Build PRG (next to the source)', accelerator: 'CmdOrCtrl+B', click: () => send('build:build') },
        { label: 'Save as PRG… (with Exomizer option)', click: () => send('build:savePrg') },
        { type: 'separator' },
        { label: 'Build && Run in VICE', accelerator: 'F5', click: () => send('build:run') },
        { label: 'Build, Pack && Run in VICE', accelerator: 'Shift+F5', click: () => send('build:runPacked') }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Number Converter (HEX / DEC / BIN)', accelerator: 'CmdOrCtrl+K', click: () => send('tools:converter') },
        { label: 'Relocate SID (sidreloc)…', click: () => send('tools:sidreloc') },
        { label: 'SID File Info…', click: () => send('tools:sidinfo') },
        { label: 'Pack a PRG with Exomizer…', click: () => send('tools:exomizer') },
        { type: 'separator' },
        { label: 'Tool Paths && Status…', click: () => send('settings:open', 'tools') }
      ]
    },
    {
      label: 'Emulator',
      submenu: [
        { label: 'Build && Run in VICE  (F5)', click: () => send('build:run') },
        { label: 'Run a PRG File in VICE…', click: () => send('vice:runFile') },
        { label: 'Start VICE (empty)', click: () => send('vice:start') },
        { type: 'separator' },
        { label: 'VICE Settings…', click: () => send('settings:open', 'vice') }
      ]
    },
    { label: 'Examples', submenu: exampleMenu() },
    {
      label: 'View',
      submenu: [
        { label: 'Day / Night Mode', accelerator: 'CmdOrCtrl+T', click: () => send('view:theme') },
        { type: 'separator' },
        { label: 'Memory Map', accelerator: 'CmdOrCtrl+M', click: () => send('view:memmap') },
        { label: 'Problems Panel', accelerator: 'CmdOrCtrl+J', click: () => send('view:problems') },
        { label: 'Word Wrap', accelerator: 'Alt+Z', click: () => send('view:wrap') },
        { label: 'Show Invisible Characters', click: () => send('view:invisibles') },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => send('view:zoomIn') },
        { label: 'Zoom In ', accelerator: 'CmdOrCtrl+=', visible: false, click: () => send('view:zoomIn') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => send('view:zoomOut') },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => send('view:zoomReset') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { label: 'Developer Tools', accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: () => win && win.webContents.toggleDevTools() }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Help Center', accelerator: 'F1', click: () => send('help:open') },
        { label: 'Help for Word at Cursor', accelerator: 'CmdOrCtrl+F1', click: () => send('help:context') },
        { type: 'separator' },
        { label: '6502 Instruction Set', click: () => send('help:open', 'opcodes') },
        { label: 'ACME Pseudo Opcodes', click: () => send('help:open', 'acme-po') },
        { label: 'C64 Memory Map', click: () => send('help:open', 'memmap') },
        { label: 'VIC-II Registers', click: () => send('help:open', 'vic') },
        { label: 'SID Registers', click: () => send('help:open', 'sid') },
        { label: 'KERNAL Routines', click: () => send('help:open', 'kernal') },
        { label: 'PETSCII & Screen Codes', click: () => send('help:open', 'petscii') },
        { label: 'Keyboard Shortcuts', click: () => send('help:open', 'shortcuts') },
        { type: 'separator' },
        { label: `Info / About ${APP_NAME}`, click: () => send('help:about') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --------------------------------------------------------------- utilities
function readSid(file) {
  try {
    const b = fs.readFileSync(file);
    return Asm.parseSidHeader(b);
  } catch (e) { return null; }
}

function resolveInclude(name, fromFile, baseDir) {
  const tries = [];
  if (path.isAbsolute(name)) tries.push(name);
  if (fromFile && path.isAbsolute(fromFile)) tries.push(path.join(path.dirname(fromFile), name));
  if (baseDir) tries.push(path.join(baseDir, name));
  for (const t of tries) {
    try { if (fs.statSync(t).isFile()) return t; } catch (e) { /* next */ }
  }
  return null;
}

// --------------------------------------------------------------------- IPC
function registerIpc() {
  ipcMain.handle('app:info', () => ({
    name: APP_NAME, version: APP_VERSION, author: APP_AUTHOR, platform: process.platform, arch: process.arch,
    electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node,
    examplesDir: EXAMPLES_DIR(), userData: app.getPath('userData'), home: app.getPath('home'), documents: app.getPath('documents')
  }));
  ipcMain.on('app:closeConfirmed', () => { forceClose = true; if (win) win.close(); });
  ipcMain.handle('app:setTitle', (e, t) => { if (win) win.setTitle(t); });
  ipcMain.handle('app:pendingFiles', () => pendingOpen.splice(0));

  ipcMain.handle('settings:get', () => settings.get());
  ipcMain.handle('settings:set', (e, partial) => {
    const r = settings.set(partial);
    tools.cache = {};
    nativeTheme.themeSource = r.theme === 'day' ? 'light' : 'dark';
    return r;
  });

  ipcMain.handle('dialog:open', async (e, opts) => {
    // self test only: answer the open dialog with a fixed file
    if (process.env.C64AE_AUTOTEST && process.env.C64AE_AUTOTEST_OPEN) return [process.env.C64AE_AUTOTEST_OPEN];
    const r = await dialog.showOpenDialog(win, Object.assign({ properties: ['openFile'], defaultPath: settings.get().lastDir || undefined }, opts || {}));
    return r.canceled ? null : r.filePaths;
  });
  ipcMain.handle('dialog:save', async (e, opts) => {
    const r = await dialog.showSaveDialog(win, Object.assign({}, opts || {}));
    return r.canceled ? null : r.filePath;
  });
  ipcMain.handle('dialog:message', async (e, opts) => {
    const r = await dialog.showMessageBox(win, opts);
    return r.response;
  });

  ipcMain.handle('file:read', (e, file, opts) => {
    const text = fs.readFileSync(file, 'utf8');
    if (!(opts && opts.noRecent)) { settings.addRecent(file); buildMenu(); }
    return { path: file, text };
  });
  ipcMain.handle('file:write', (e, file, text) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
    settings.addRecent(file); buildMenu();
    return { path: file, mtime: fs.statSync(file).mtimeMs };
  });
  ipcMain.handle('file:exists', (e, file) => fs.existsSync(file));
  ipcMain.handle('file:copy', (e, from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); return true; });
  ipcMain.handle('file:stat', (e, file) => { try { const s = fs.statSync(file); return { size: s.size, mtime: s.mtimeMs }; } catch (err) { return null; } });

  // synchronous include resolution for the live checker
  ipcMain.on('include:source', (e, name, fromFile, baseDir) => {
    const p = resolveInclude(name, fromFile, baseDir);
    if (!p) { e.returnValue = null; return; }
    try { e.returnValue = { path: p, text: fs.readFileSync(p, 'utf8') }; } catch (err) { e.returnValue = null; }
  });
  ipcMain.on('include:binary', (e, name, fromFile, baseDir) => {
    const p = resolveInclude(name, fromFile, baseDir);
    if (!p) { e.returnValue = null; return; }
    try {
      const st = fs.statSync(p);
      let sid = null;
      if (/\.sid$/i.test(p) || st.size > 0x7c) {
        const fd = fs.openSync(p, 'r'); const buf = Buffer.alloc(Math.min(st.size, 0x7e + 2)); fs.readSync(fd, buf, 0, buf.length, 0); fs.closeSync(fd);
        const full = Buffer.concat([buf, Buffer.alloc(0)]);
        const h = Asm.parseSidHeader(full);
        if (h) { h.dataSize = st.size - h.skip; h.endAddress = h.loadAddress + h.dataSize - 1; sid = h; }
      }
      e.returnValue = { path: p, size: st.size, sid, kla: /\.(kla|koa)$/i.test(p) };
    } catch (err) { e.returnValue = null; }
  });

  ipcMain.handle('tools:status', () => tools.status());
  ipcMain.handle('tools:pick', async (e, tool) => {
    const r = await dialog.showOpenDialog(win, { title: `Locate ${tool}`, properties: ['openFile', 'openDirectory', 'treatPackageAsDirectory'] });
    if (r.canceled) return null;
    const paths = Object.assign({}, settings.get().paths, { [tool]: r.filePaths[0] });
    settings.set({ paths });
    tools.cache = {};
    return r.filePaths[0];
  });

  ipcMain.handle('acme:assemble', (e, opts) => tools.assemble(opts));
  ipcMain.handle('exomizer:pack', (e, opts) => tools.pack(opts));
  ipcMain.handle('sidreloc:run', (e, opts) => tools.sidreloc(opts));
  ipcMain.handle('sid:info', (e, file) => readSid(file));
  ipcMain.handle('vice:run', (e, prg, labels) => tools.runVice(prg, labels));
  ipcMain.handle('vice:args', (e, prg) => tools.viceArgs(settings.get().vice, prg, null));

  ipcMain.handle('examples:list', () => {
    const dir = EXAMPLES_DIR();
    let list = [];
    try { list = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')); } catch (err) { /* ignore */ }
    return { dir, list };
  });
  ipcMain.handle('snippets:list', () => {
    const dir = SNIPPETS_DIR();
    let index = { categories: [], snippets: [] };
    try { index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')); } catch (err) { /* ignore */ }
    return { dir, index };
  });
  ipcMain.handle('shell:openExternal', (e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
  ipcMain.handle('shell:showItem', (e, file) => shell.showItemInFolder(file));
}

// ------------------------------------------------------------- app events
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    const files = argv.slice(1).filter(a => /\.(asm|a|s|acme|inc|src|txt)$/i.test(a) && fs.existsSync(a));
    files.forEach(f => send('file:open-path', path.resolve(f)));
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.on('open-file', (e, file) => { e.preventDefault(); if (win) send('file:open-path', file); else pendingOpen.push(file); });

  app.whenReady().then(() => {
    settings = new Settings(app.getPath('userData'));
    tools = new Tools(app, settings);
    nativeTheme.themeSource = settings.get().theme === 'day' ? 'light' : 'dark';
    const argFiles = process.argv.slice(app.isPackaged ? 1 : 2).filter(a => /\.(asm|a|s|acme|inc|src|txt)$/i.test(a) && fs.existsSync(a));
    pendingOpen.push(...argFiles.map(f => path.resolve(f)));
    registerIpc();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => app.quit());
}
