// Usage: node run-example.js <prg> <frames> <out.ppm> [keys...]
//   Boots the KERNAL, loads the PRG like VICE's autostart, types RUN and
//   runs the given number of frames. Writes a screenshot (PPM).
//   ROM directory: env C64_ROMS
'use strict';
const { C64 } = require('./c64.js');
const [prg, frames, out, ...extra] = process.argv.slice(2);
const c = new C64(process.env.C64_ROMS);
c.boot();
const info = c.loadPrg(prg);
if (info.load === 0x0801) c.type('RUN\n');
else c.type(`SYS${info.load}\n`);
const opts = {};
for (const e of extra) { const [k, v] = e.split('='); opts[k] = v; }
const total = parseInt(frames, 10);
let shots = 0;
for (let f = 0; f < total; f++) {
  if (opts.pressAt && f === parseInt(opts.pressAt, 10)) c.keys.add(opts.key);
  if (opts.typeAt && f === parseInt(opts.typeAt, 10)) c.type(opts.text);
  c.runFrames(1);
  if (opts.every && f % parseInt(opts.every, 10) === 0 && shots < 6) c.savePPM(out.replace('.ppm', `_${shots++}.ppm`));
}
c.savePPM(out);
if (opts.text !== undefined || opts.screen) console.log(c.screenText());
if (opts.sid) {
  const log = c.sidLog;
  console.log('SID writes:', log.length);
  const freqs = new Set(log.filter(l => l[2] === 1).map(l => l[3]));
  console.log('distinct voice1 freq hi:', [...freqs].length, ' gates v1:', log.filter(l => l[2] === 4 && (l[3] & 1)).length, ' v2:', log.filter(l => l[2] === 11 && (l[3] & 1)).length, ' v3:', log.filter(l => l[2] === 18 && (l[3] & 1)).length);
  const perFrame = {};
  for (const l of log) if (l[2] === 0x0b) perFrame[l[0]] = (perFrame[l[0]] || 0) + 1;
}
console.log(`frame ${c.frame} pc=$${c.cpu.pc.toString(16)} border=${c.vic[0x20] & 15} d011=$${c.vic[0x11].toString(16)} d016=$${c.vic[0x16].toString(16)} d018=$${c.vic[0x18].toString(16)}`);
