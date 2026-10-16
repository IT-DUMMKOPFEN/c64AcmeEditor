/*
 * C64 ACME EDITOR - persistent settings (JSON file in the user data folder)
 * (c) IT-Dummköpfe - MIT License
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  theme: 'night',                 // 'day' | 'night'
  fontSize: 15,
  wordWrap: false,
  showInvisibles: false,
  tabSize: 8,
  useSoftTabs: true,
  liveAcmeCheck: true,            // run the real ACME in the background
  autocomplete: true,             // suggestions while typing
  session: { files: [], active: null },
  showMemoryMap: true,
  showProblems: true,
  recentFiles: [],
  lastDir: '',
  paths: { acme: '', exomizer: '', sidreloc: '', vice: '' },
  vice: {
    model: 'c64',                 // -model c64 | c64c | c64old | ntsc | newntsc | oldntsc | drean
    sidModel: 'auto',             // auto | 0 (6581) | 1 (8580)
    sidEngine: 'auto',            // auto | 0 FastSID | 1 ReSID | 8 ReSIDfp
    borders: '0',                 // -VICIIborders 0 normal 1 full 2 debug 3 none
    doubleSize: true,             // -VICIIdsize
    filter: 'auto',               // -VICIIfilter 0 none 1 CRT 2 scale2x
    fullscreen: false,            // -VICIIfull
    warpAutostart: true,          // -autostart-warp
    prgMode: '1',                 // -autostartprgmode 0 vfs 1 inject 2 d64
    trueDrive: false,             // -drive8truedrive / +drive8truedrive
    joyPort1: 'auto',             // -joydev1
    joyPort2: '1',                // -joydev2  (1 = numpad)
    sound: true,                  // -sound / +sound
    monitorLabels: false,          // load the ACME labels into the VICE monitor
    useDefaults: false,           // -default (ignore VICE's own saved settings)
    extraArgs: ''
  },
  exomizer: {
    askOnSave: true,
    defaultPack: false,
    start: 'auto',                // auto | sys | custom
    customStart: '$0810',
    effect: 'none'                // none | x1 | x2 | x3
  }
};

function merge(base, over) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  if (!over || typeof over !== 'object') return out;
  for (const k of Object.keys(over)) {
    if (base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])) out[k] = merge(base[k], over[k]);
    else out[k] = over[k];
  }
  return out;
}

class Settings {
  constructor(dir) {
    this.file = path.join(dir, 'settings.json');
    this.data = merge(DEFAULTS, {});
    try {
      if (fs.existsSync(this.file)) this.data = merge(DEFAULTS, JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } catch (e) {
      console.error('settings: could not read', e.message);
    }
  }
  get() { return JSON.parse(JSON.stringify(this.data)); }
  set(partial) {
    this.data = merge(this.data, partial || {});
    this.save();
    return this.get();
  }
  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('settings: could not write', e.message);
    }
  }
  addRecent(file) {
    const list = (this.data.recentFiles || []).filter(f => f !== file);
    list.unshift(file);
    this.data.recentFiles = list.slice(0, 12);
    this.data.lastDir = path.dirname(file);
    this.save();
  }
}

module.exports = { Settings, DEFAULTS };
