// TO: NULL: deterministické statické obrazovky ?obrazovka=1..9 (SPEC 7). Seed 1000 + n, zmrazený čas,
// jeden snímok bez requestAnimationFrame, písací stroj dopísaný, zvuk vypnutý, uloženie sa nečíta ani nezapisuje.

import * as E from './ekonomika.mjs';

export const T0 = 1_800_000_000_000;

function zaklad(n) {
  const s = E.novyStav(1000 + n, T0);
  s.lastSeen = T0;
  s.snd.on = false;
  return s;
}
const bity = (s, ...ids) => { for (const i of ids) if (!s.beats.includes(i)) s.beats.push(i); };
const log = (s, ...z) => { for (const x of z) s.log.push(typeof x === 'string' ? { id: x } : x); };
const BOOT = ['boot1', 'boot2', 'boot3'];

/** Vráti { s, scena } pre obrazovku n (1 až 9). */
export function fixtura(n) {
  const s = zaklad(n);
  const scena = { n, cas: 10000, glitch: null, lex: -1, spanok: -1, navrat: null, koniec: false, karta: null, prikazy: [], tab: 'proc' };
  switch (n) {
    case 1: {
      s.g = 3; s.tot = 3; s.run = 3; s.stats.taps = 3; s.stats.playMs = 8000;
      bity(s, ...BOOT, 'gc.a1', 'gc.a2');
      log(s, ...BOOT, 'gc.a1', 'gc.a2');
      scena.tab = 'log';
      break;
    }
    case 2: {
      Object.assign(s, { sec: 3, g: 1000, run: 4200, tot: 4200, att: 62 });
      s.n.hook = 33; s.n.sieve = 17; s.up = ['steady', 'barbed']; s.stats.taps = 610; s.stats.playMs = 300000;
      bity(s, ...BOOT, 'gc.a1', 'gc.a2', 'gc.a3', 'gc.a4', 'gc.a5', 'gc.a6', 'gc.a7', 'K1', 'gc.a8', 'gc.a9', 'gc.a10', 'K2', 'gc.a11', 'K3', 'gc.a12');
      log(s, 'K1', 'gc.a8', 'gc.a9', 'gc.a10', 'K2', { h: 'you', t: 'whoami' }, { h: 'sys', t: '▒▒▒_▒▒▒▒' });
      scena.glitch = { k: (62 - 50) / 50, pasy: [[6, 1]], off: 1, znak: true };
      break;
    }
    case 3: {
      Object.assign(s, { act: 2, sec: 7, stacks: 1, sleeps: 2, lines: 2, R: 10, g: 61000, run: 900000, tot: 1.1e6 });
      s.n.hook = 20; s.n.sieve = 17; s.n.thread = 5; s.stats.playMs = 1200000;
      bity(s, ...BOOT, 'gc.a1', 'gc.a2', 'gc.a3', 'gc.a4', 'gc.a5', 'gc.a6', 'gc.a7', 'K1', 'gc.a8', 'gc.a9', 'gc.a10', 'K2', 'gc.a11',
        'K3', 'gc.a12', 'gc.a13', 'gc.a14', 'K4', 'gc.a15', 'gc.a16', 'gc.a17', 'K5', 'gc.a18', 'K6', 'exit', 'gc.a19', 'gc.a20', 'K7', 'gc.a21',
        'gc.s1', 'K8', 'gc.b1', 'wake.2', 'gc.b2', 'gc.b3', 'K9', 'gc.b4', 'gc.b5', 'gc.a10b', 'K3b');
      log(s, 'gc.b2', 'gc.b3', 'K9', 'gc.b4', 'gc.b5');
      break;
    }
    case 4: {
      Object.assign(s, { act: 3, sec: 7, stacks: 5, dec: 4, sleeps: 4, lines: 4, R: 40, g: 612e6, run: 1.2e9, tot: 2.1e9, lex: true });
      s.n.hook = 60; s.n.sieve = 55; s.n.thread = 40; s.n.bank = 30;
      log(s, 'K10', 'K11', 'gc.b7', 'K12', 'gc.b8', 'K13', 'gc.b9', 'gc.b10', 'K14', 'gc.b11');
      scena.lex = 2600;
      scena.lexMeno = 'GLYPHS';
      break;
    }
    case 5: {
      Object.assign(s, { act: 2, sec: 7, stacks: 2, sleeps: 3, lines: 3, R: 20, g: 12000, run: 3e6, tot: 1.2e7, dec: 1 });
      s.n.hook = 30; s.n.sieve = 20; s.n.thread = 12; s.n.bank = 3;
      log(s, 'K9', 'gc.b4', 'gc.b5', 'gc.b6', 'K10');
      scena.navrat = { dt: 22320000, zisk: 41200, listy: 0 };
      break;
    }
    case 6: {
      Object.assign(s, { act: 3, sec: 7, stacks: 5, dec: 5, sleeps: 6, lines: 6, R: 180, g: 2.31e12, run: 3e12, tot: 9e12, lex: true, mode: 'mend', mended: 412, keys: 2, mendMs: 600000 });
      s.themes = ['green', 'amber', 'rose'];
      s.n.hook = 120; s.n.sieve = 110; s.n.thread = 80; s.n.bank = 60; s.n.loom = 40; s.up = ['steady', 'barbed', 'grip', 'mesh', 'deep', 'taut', 'warm', 'weave'];
      s.cmp = { m0: 0, c: 1, m: 2 };
      log(s, 'K.c5', 'gc.c8', 'K.c6', 'K.c7', { h: 'mended', t: 'mended 0412 · to: e., quay road' }, { h: 'letter', t: 'the kettle is on. come home when you can.' }, { h: 'sys', t: 'from r., hill steps' }, { h: 'pre', seed: 412 });
      break;
    }
    case 7: {
      Object.assign(s, { sec: 6, g: 9000, run: 30000, tot: 30000, att: 92 });
      s.n.hook = 52; s.n.sieve = 30; s.up = ['steady', 'barbed', 'grip', 'mesh', 'deep']; s.stats.playMs = 540000;
      log(s, 'gc.a16', 'gc.a17', 'K5', 'gc.a18', 'K6', 'gc.a12');
      scena.glitch = { k: (92 - 50) / 50, pasy: [[4, 2], [9, 1], [14, 3]], off: 2, znak: true };
      break;
    }
    case 8: {
      Object.assign(s, { act: 2, sec: 7, stacks: 1, sleeps: 3, lines: 2, R: 12, g: 0, run: 0, tot: 2.6e6 });
      s.n.hook = 1;
      scena.spanok = 1400;
      scena.spanokZ = { uptime: 14624, riadok: 2 };
      break;
    }
    case 9: {
      Object.assign(s, { act: 3, sec: 7, stacks: 5, dec: 5, sleeps: 8, lines: 7, R: 260, g: 4e14, run: 5e14, tot: 3e15, lex: true, mode: 'mend', mended: 1000, keys: 3, ended: true });
      s.themes = ['green', 'amber', 'rose'];
      s.n.hook = 150; s.n.sieve = 140; s.n.thread = 110; s.n.bank = 90; s.n.loom = 70;
      log(s, 'K.c9', 'K.c10', 'end.cmd', 'end.ans', 'K.c11');
      scena.koniec = true;
      break;
    }
    default: break;
  }
  return { s, scena };
}
