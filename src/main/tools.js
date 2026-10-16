/*
 * C64 ACME EDITOR - external tools: ACME, Exomizer, sidreloc, VICE
 * (c) IT-Dummköpfe - MIT License
 *
 * The tools are bundled in <resources>/tools (packaged app) or vendor/tools
 * (development). Users can override every path in the settings.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const exe = name => IS_WIN ? name + '.exe' : name;

const TOOL_INFO = {
  acme: { bin: 'acme', title: 'ACME Crossassembler', url: 'https://sourceforge.net/projects/acme-crossass/' },
  exomizer: { bin: 'exomizer', title: 'Exomizer', url: 'https://bitbucket.org/magli143/exomizer/wiki/Home' },
  sidreloc: { bin: 'sidreloc', title: 'sidreloc', url: 'https://www.linusakesson.net/software/sidreloc/index.php' },
  vice: { bin: 'x64sc', title: 'VICE (x64sc)', url: 'https://vice-emu.sourceforge.io/' }
};

class Tools {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
    this.cache = {};
    this.cleanTemp();
  }

  // remove old temporary build files (older than one day)
  cleanTemp() {
    try {
      const d = path.join(this.app.getPath('userData'), 'build');
      if (!fs.existsSync(d)) return;
      const limit = Date.now() - 24 * 3600 * 1000;
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        try { if (fs.statSync(p).mtimeMs < limit) fs.unlinkSync(p); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  }

  vendorDir() {
    if (this.app.isPackaged) return path.join(process.resourcesPath, 'tools');
    return path.join(__dirname, '..', '..', 'vendor', 'tools');
  }

  isExecutable(p) {
    try {
      const st = fs.statSync(p);
      if (!st.isFile()) return false;
      if (IS_WIN) return true;
      fs.accessSync(p, fs.constants.X_OK);
      return true;
    } catch (e) { return false; }
  }

  // search a directory tree (limited depth) for an executable
  findIn(dir, name, depth) {
    if (depth < 0 || !fs.existsSync(dir)) return null;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return null; }
    for (const e of entries) {
      if (e.isFile() && e.name === name) {
        const p = path.join(dir, e.name);
        if (this.isExecutable(p)) return p;
      }
    }
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.')) {
        const r = this.findIn(path.join(dir, e.name), name, depth - 1);
        if (r) return r;
      }
    }
    return null;
  }

  which(name) {
    const dirs = (process.env.PATH || '').split(path.delimiter);
    if (IS_MAC) dirs.push('/opt/homebrew/bin', '/usr/local/bin');
    if (!IS_WIN) dirs.push('/usr/bin', '/usr/local/bin', '/usr/games', '/snap/bin');
    for (const d of dirs) {
      if (!d) continue;
      const p = path.join(d, name);
      if (this.isExecutable(p)) return p;
    }
    return null;
  }

  // returns { path, source } or null
  locate(tool, force) {
    if (!force && this.cache[tool] !== undefined) return this.cache[tool];
    const info = TOOL_INFO[tool];
    const name = exe(info.bin);
    const custom = (this.settings.get().paths || {})[tool];
    let found = null;
    if (custom) {
      if (this.isExecutable(custom)) found = { path: custom, source: 'settings' };
      else if (fs.existsSync(custom) && fs.statSync(custom).isDirectory()) {
        const p = this.findIn(custom, name, 6);
        if (p) found = { path: p, source: 'settings' };
      } else {
        // a command line, e.g. "flatpak run net.sf.VICE"
        const parts = splitArgs(custom);
        const exePath = parts.length ? (this.isExecutable(parts[0]) ? parts[0] : this.which(parts[0])) : null;
        if (exePath) found = { path: exePath, args: parts.slice(1), source: 'settings' };
      }
    }
    if (!found) {
      const vendor = this.vendorDir();
      const direct = path.join(vendor, name);
      if (this.isExecutable(direct)) found = { path: direct, source: 'bundled' };
      else {
        const p = this.findIn(path.join(vendor, tool), name, 7);
        if (p) found = { path: p, source: 'bundled' };
      }
    }
    if (!found) {
      const p = this.which(name);
      if (p) found = { path: p, source: 'system' };
    }
    if (!found && tool === 'vice') {
      const candidates = [];
      if (IS_MAC) {
        for (const base of ['/Applications', path.join(os.homedir(), 'Applications'), path.join(os.homedir(), 'Downloads')]) {
          try {
            for (const d of fs.readdirSync(base)) if (/vice/i.test(d)) candidates.push(path.join(base, d));
          } catch (e) { /* ignore */ }
        }
      }
      if (IS_WIN) {
        // VICE for Windows is a zip without installer: look in the usual
        // places where people unpack it (folders with "vice" in the name)
        const home = os.homedir();
        for (const base of [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'], 'C:\\', process.env['LOCALAPPDATA'] && path.join(process.env['LOCALAPPDATA'], 'Programs'),
          home, path.join(home, 'Downloads'), path.join(home, 'Desktop'), path.join(home, 'Documents')]) {
          if (!base) continue;
          try { for (const d of fs.readdirSync(base)) if (/vice/i.test(d)) candidates.push(path.join(base, d)); } catch (e) { /* ignore */ }
        }
      }
      for (const c of candidates) {
        const p = this.findIn(c, name, 6);
        if (p) { found = { path: p, source: 'system' }; break; }
      }
      if (!found && !IS_WIN && !IS_MAC) {
        for (const fp of ['/var/lib/flatpak/exports/bin/net.sf.VICE', path.join(os.homedir(), '.local/share/flatpak/exports/bin/net.sf.VICE')]) {
          if (this.isExecutable(fp)) { found = { path: fp, source: 'flatpak' }; break; }
        }
      }
    }
    this.cache[tool] = found;
    return found;
  }

  status() {
    const out = {};
    for (const t of Object.keys(TOOL_INFO)) {
      const f = this.locate(t, true);
      out[t] = { found: !!f, path: f ? f.path : '', source: f ? f.source : '', title: TOOL_INFO[t].title, url: TOOL_INFO[t].url, version: '' };
      if (f && t === 'acme') {
        try {
          const r = spawnSync(f.path, ['-V'], { encoding: 'utf8', timeout: 4000 });
          const m = ((r.stdout || '') + (r.stderr || '')).match(/release\s+([0-9.]+[^\s,]*)/i);
          out[t].version = m ? m[1] : '';
        } catch (e) { /* ignore */ }
      }
    }
    return out;
  }

  run(file, args, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      let stdout = '', stderr = '';
      let child;
      try {
        child = spawn(file, args, { cwd: opts.cwd || os.tmpdir(), windowsHide: true });
      } catch (e) {
        resolve({ code: -1, stdout: '', stderr: String(e.message || e), error: true });
        return;
      }
      const timer = setTimeout(() => { try { child.kill(); } catch (e) { /* ignore */ } }, opts.timeout || 60000);
      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('error', e => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: stderr + String(e.message || e), error: true }); });
      child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    });
  }

  tempDir() {
    // inside the user data folder (also reachable for a sandboxed VICE)
    const d = path.join(this.app.getPath('userData'), 'build');
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  // ---------------------------------------------------------------- ACME
  parseAcmeOutput(text, mapFile, baseDir) {
    const diags = [];
    const re = /^(Warning|Error|Serious error) - File (.+?), line (\d+)(?: \(([^)]*)\))*: (.*)$/;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/\x1b\[[0-9;]*m/g, '').trim();
      const m = line.match(re);
      if (!m) continue;
      const msg = m[5].trim();
      if (/Output file already chosen/i.test(msg)) continue;   // we always pass -o
      let file = m[2];
      if (mapFile && path.resolve(baseDir || '', file) === path.resolve(mapFile.temp)) file = mapFile.doc;
      else if (mapFile && file === mapFile.temp) file = mapFile.doc;
      else if (!path.isAbsolute(file) && baseDir) file = path.join(baseDir, file);
      diags.push({
        severity: m[1] === 'Warning' ? 'warning' : 'error',
        file, line: parseInt(m[3], 10) - 1, col: 0, endCol: 1, message: msg, source: 'acme'
      });
    }
    const saving = text.match(/Saving (\d+) \(0x[0-9a-f]+\) bytes \(0x([0-9a-f]+) - 0x([0-9a-f]+) exclusive\)/i);
    return { diags, size: saving ? parseInt(saving[1], 10) : null, start: saving ? parseInt(saving[2], 16) : null, end: saving ? parseInt(saving[3], 16) : null };
  }

  /**
   * Assemble source text.
   * opts: { source, docPath, baseDir, outFile, format, labels }
   */
  async assemble(opts) {
    const acme = this.locate('acme');
    if (!acme) return { ok: false, missing: 'acme', diags: [], log: 'ACME was not found. Set its path in Settings > Tools.' };
    const tmp = this.tempDir();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const baseName = opts.docPath ? path.basename(opts.docPath).replace(/[^\w.-]+/g, '_') : 'untitled.asm';
    const srcFile = path.join(tmp, id + '_' + baseName);
    fs.writeFileSync(srcFile, opts.source, 'utf8');
    const baseDir = opts.baseDir || (opts.docPath ? path.dirname(opts.docPath) : tmp);
    const outFile = opts.outFile || path.join(tmp, id + '.prg');
    const args = ['-v1', '-f', opts.format || 'cbm', '-o', outFile, '-I', baseDir];
    let labelFile = null;
    if (opts.labels) { labelFile = outFile.replace(/\.[^.\\/]+$/, '') + '.vs'; args.push('--vicelabels', labelFile); }
    args.push(srcFile);
    const r = await this.run(acme.path, args, { cwd: baseDir, timeout: opts.timeout || 30000 });
    try { fs.unlinkSync(srcFile); } catch (e) { /* ignore */ }
    const text = (r.stdout || '') + '\n' + (r.stderr || '');
    const parsed = this.parseAcmeOutput(text, { temp: srcFile, doc: opts.docPath || 'untitled' }, baseDir);
    const ok = r.code === 0 && fs.existsSync(outFile);
    return {
      ok, code: r.code, diags: parsed.diags, outFile: ok ? outFile : null, labelFile: ok && labelFile && fs.existsSync(labelFile) ? labelFile : null,
      start: parsed.start, end: parsed.end, size: parsed.size,
      log: text.split(/\r?\n/).filter(l => l.trim() && !/Output file already chosen/.test(l)).map(l => l.split(srcFile).join(opts.docPath ? path.basename(opts.docPath) : 'untitled')).join('\n')
    };
  }

  // ------------------------------------------------------------- Exomizer
  async pack(opts) {
    const exo = this.locate('exomizer');
    if (!exo) return { ok: false, missing: 'exomizer', log: 'Exomizer was not found. Set its path in Settings > Tools.' };
    const args = ['sfx'];
    args.push(opts.start || 'sys');
    if (opts.effect && opts.effect !== 'none') args.push('-' + opts.effect);
    else args.push('-n');
    args.push('-q', '-o', opts.output, opts.input);
    const r = await this.run(exo.path, args, { cwd: path.dirname(opts.input), timeout: 120000 });
    const ok = r.code === 0 && fs.existsSync(opts.output);
    return { ok, code: r.code, log: ('exomizer ' + args.join(' ') + '\n' + r.stdout + '\n' + r.stderr).trim(), size: ok ? fs.statSync(opts.output).size : 0 };
  }

  // -------------------------------------------------------------- sidreloc
  async sidreloc(opts) {
    const sr = this.locate('sidreloc');
    if (!sr) return { ok: false, missing: 'sidreloc', log: 'sidreloc was not found. Set its path in Settings > Tools.' };
    const args = ['-p', opts.page];
    if (opts.keepZp) args.push('-k');
    else if (opts.zp) args.push('-z', opts.zp);
    if (opts.reloc) args.push('-r', opts.reloc);
    if (opts.force) args.push('-f');
    if (opts.strict) args.push('-s');
    if (opts.tolerance) args.push('-t', String(opts.tolerance));
    args.push('-v', opts.input, opts.output);
    try { fs.mkdirSync(path.dirname(opts.output), { recursive: true }); } catch (e) { /* sidreloc reports the error */ }
    const r = await this.run(sr.path, args, { cwd: path.dirname(opts.input), timeout: 180000 });
    const base = r.code & 31;
    const MESSAGES = {
      0: 'Relocation successful.', 1: 'Not a valid SID file header.', 2: 'Bad SID file: RSID requirements not fulfilled.',
      3: 'MUS files are not supported.', 4: 'BASIC tunes are not supported.', 5: 'PSID extensions are not supported.',
      6: 'Bad command line parameters.', 7: 'Input/output error.', 8: 'Relocation failed: no solution found.',
      9: 'Relocation failed: zero page full - try another zero page range.', 10: 'Verification failed (try "force" or a higher tolerance).',
      11: 'Could not determine the play routine address.', 12: 'Invalid relocation range.', 13: 'Maximum clock cycles exhausted.'
    };
    const warnings = [];
    if (r.code > 0 && (r.code & 32)) warnings.push('The tune writes to memory outside its loading range.');
    if (r.code > 0 && (r.code & 64)) warnings.push('Some pitches or pulse widths did not match exactly.');
    const ok = base === 0 && r.code >= 0 && fs.existsSync(opts.output);
    return { ok, code: r.code, message: MESSAGES[base] || ('Exit code ' + r.code), warnings, log: ('sidreloc ' + args.join(' ') + '\n' + r.stdout + '\n' + r.stderr).trim() };
  }

  // ------------------------------------------------------------------ VICE
  viceArgs(v, prg, labelFile) {
    const args = [];
    if (v.useDefaults) args.push('-default');
    if (v.model && v.model !== 'auto') args.push('-model', v.model);
    if (v.sidEngine && v.sidEngine !== 'auto') args.push('-sidengine', String(v.sidEngine));
    if (v.sidModel && v.sidModel !== 'auto') args.push('-sidmodel', String(v.sidModel));
    if (v.borders !== undefined && v.borders !== 'auto') args.push('-VICIIborders', String(v.borders));
    if (v.doubleSize) args.push('-VICIIdsize');
    if (v.filter && v.filter !== 'auto') args.push('-VICIIfilter', String(v.filter));
    if (v.fullscreen) args.push('-VICIIfull');
    args.push(v.warpAutostart ? '-autostart-warp' : '+autostart-warp');
    if (v.prgMode !== undefined && v.prgMode !== 'auto') args.push('-autostartprgmode', String(v.prgMode));
    args.push(v.trueDrive ? '-drive8truedrive' : '+drive8truedrive');
    if (v.joyPort1 && v.joyPort1 !== 'auto') args.push('-joydev1', String(v.joyPort1));
    if (v.joyPort2 && v.joyPort2 !== 'auto') args.push('-joydev2', String(v.joyPort2));
    args.push(v.sound ? '-sound' : '+sound');
    if (v.monitorLabels && labelFile) args.push('-moncommands', labelFile);
    if (v.extraArgs) args.push(...splitArgs(v.extraArgs));
    if (prg) args.push('-autostart', prg);
    return args;
  }

  runVice(prg, labelFile) {
    const vice = this.locate('vice');
    if (!vice) return { ok: false, missing: 'vice', log: 'VICE (x64sc) was not found. Set its path in Settings > Emulator.' };
    const v = this.settings.get().vice;
    const args = this.viceArgs(v, prg, labelFile);
    try {
      if (this.viceProcess && !this.viceProcess.killed && this.viceProcess.exitCode === null) {
        try { this.viceProcess.kill(); } catch (e) { /* ignore */ }
      }
      const child = spawn(vice.path, (vice.args || []).concat(args), { cwd: prg ? path.dirname(prg) : os.homedir(), detached: true, stdio: 'ignore', windowsHide: false });
      child.on('error', () => { /* reported below */ });
      child.unref();
      this.viceProcess = child;
      return { ok: true, log: [vice.path].concat(vice.args || [], args).join(' ') };
    } catch (e) {
      return { ok: false, log: String(e.message || e) };
    }
  }
}

// splits a command line string into arguments (supports "quoted strings")
function splitArgs(s) {
  const out = []; const re = /"([^"]*)"|'([^']*)'|(\S+)/g; let m;
  while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  return out;
}

module.exports = { Tools, TOOL_INFO, splitArgs };
