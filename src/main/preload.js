/*
 * C64 ACME EDITOR - preload bridge (the only way the UI talks to the system)
 * (c) IT-Dummköpfe - MIT License
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  info: () => ipcRenderer.invoke('app:info'),
  setTitle: (t) => ipcRenderer.invoke('app:setTitle', t),
  pendingFiles: () => ipcRenderer.invoke('app:pendingFiles'),
  closeConfirmed: () => ipcRenderer.send('app:closeConfirmed'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (p) => ipcRenderer.invoke('settings:set', p),

  openDialog: (opts) => ipcRenderer.invoke('dialog:open', opts),
  saveDialog: (opts) => ipcRenderer.invoke('dialog:save', opts),
  message: (opts) => ipcRenderer.invoke('dialog:message', opts),

  readFile: (p, opts) => ipcRenderer.invoke('file:read', p, opts),
  writeFile: (p, text) => ipcRenderer.invoke('file:write', p, text),
  exists: (p) => ipcRenderer.invoke('file:exists', p),
  copyFile: (a, b) => ipcRenderer.invoke('file:copy', a, b),
  stat: (p) => ipcRenderer.invoke('file:stat', p),

  // synchronous: used by the live checker for !source / !binary
  includeSource: (name, from, base) => ipcRenderer.sendSync('include:source', name, from, base),
  includeBinary: (name, from, base) => ipcRenderer.sendSync('include:binary', name, from, base),

  toolStatus: () => ipcRenderer.invoke('tools:status'),
  pickTool: (tool) => ipcRenderer.invoke('tools:pick', tool),
  assemble: (opts) => ipcRenderer.invoke('acme:assemble', opts),
  pack: (opts) => ipcRenderer.invoke('exomizer:pack', opts),
  sidreloc: (opts) => ipcRenderer.invoke('sidreloc:run', opts),
  sidInfo: (p) => ipcRenderer.invoke('sid:info', p),
  runVice: (prg, labels) => ipcRenderer.invoke('vice:run', prg, labels),
  viceArgs: (prg) => ipcRenderer.invoke('vice:args', prg),

  examples: () => ipcRenderer.invoke('examples:list'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  showItem: (p) => ipcRenderer.invoke('shell:showItem', p),

  onMenu: (cb) => ipcRenderer.on('menu', (e, cmd, arg) => cb(cmd, arg)),
  onRequestClose: (cb) => ipcRenderer.on('app:request-close', () => cb())
});
