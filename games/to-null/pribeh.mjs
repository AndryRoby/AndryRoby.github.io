// TO: NULL: všetky texty a spúšťače (SPEC 2.2 až 2.6). Čisté funkcie, bez DOM.
// Hlasy: gc (jantárová, malé), KEEPER (azúrová, VEĽKÉ), you (>, fosfor), sys (systém, bez predpony), letter (listy).
// Spúšťač je vždy čin alebo stav hráča; "po" = oneskorenie v ms od chvíle, keď podmienka prvýkrát platí.

import { LIST, K as EK, dalsiaBrana } from './ekonomika.mjs';
import { tisice } from './format.mjs';

const ma = (s, id) => s.beats.includes(id);

/** Riadky logu: { id, h, t } alebo KEEPER s hlavičkou a chvostom { id, h: 'keeper', hl, ch }. */
export const BEATS = [
  // Boot (systém, písací stroj 8 ms na znak)
  { id: 'boot1', h: 'sys', t: '> lantern relay 2.3', kedy: () => true },
  { id: 'boot2', h: 'sys', t: '> process 0 resumed. uptime: 14,622 days.', kedy: (s) => ma(s, 'boot1') },
  { id: 'boot3', h: 'sys', t: '> queue: 11,204 held. route: none.', kedy: (s) => ma(s, 'boot2') },
  // Akt I: BOOT
  { id: 'gc.a1', h: 'gc', t: 'there you are. good.', kedy: (s) => ma(s, 'boot3') },
  { id: 'gc.a2', h: 'gc', t: 'catch.', kedy: (s) => ma(s, 'gc.a1'), po: 600 },
  { id: 'gc.a3', h: 'gc', t: "that's it. they fall, you catch.", kedy: (s) => s.stats.taps >= 1 && ma(s, 'gc.a2') },
  { id: 'gc.a4', h: 'gc', t: 'a hook catches while you rest. fifteen glyphs.', kedy: (s) => s.tot >= 10 && s.sleeps === 0 },
  { id: 'gc.a5', h: 'gc', t: 'good. now it works without you.', kedy: (s) => s.n.hook >= 1 && s.sleeps === 0 },
  { id: 'gc.a6', h: 'gc', t: 'sector 01 is locked. locks are slow doors.', kedy: (s) => s.tot >= 15 && s.sec === 0 },
  { id: 'gc.a7', h: 'gc', t: 'open. more rain behind it. there always is.', kedy: (s) => s.sec >= 1 },
  { id: 'K1', h: 'keeper', hl: 'INTRUSION. SECTOR 2.', ch: 'PLEASE STOP.', kedy: (s) => s.sec >= 2 },
  { id: 'gc.a8', h: 'gc', t: "that's the keeper. old index process. loud, harmless.", kedy: (s) => s.sec >= 2, po: 20000 },
  { id: 'gc.a9', h: 'gc', t: 'it notices fast hands. the bar is its attention.', kedy: (s) => s.act < 3 && s.att >= 15 },
  { id: 'gc.a10', h: 'gc', t: 'you can type now. try help.', kedy: (s) => s.sec >= 3 },
  { id: 'K2', h: 'keeper', hl: 'PROCESS 0 ACTIVE.', ch: 'YOU ARE EATING THE QUEUE.', kedy: (s) => s.sec >= 3, po: 40000 },
  // Kolo oprav 1: vypĺňa medzeru 3:09 až 4:04 (aktívny model má 12 SIEVE okolo 3:30), viazané na čin hráča.
  { id: 'gc.a10a', h: 'gc', t: 'twelve sieves. they keep the small ones too.', kedy: (s) => s.n.sieve >= 12 && s.sleeps === 0 },
  { id: 'gc.a11', h: 'gc', t: 'twenty five hooks. they bite harder together.', kedy: (s) => s.n.hook >= 25 },
  { id: 'K3', h: 'keeper', hl: 'WATCHING.', ch: 'PLEASE. SLOW DOWN.', kedy: (s) => s.act < 3 && s.att >= 50 },
  { id: 'gc.a12', h: 'gc', t: 'go dark for a moment. let it look away.', kedy: (s) => s.act < 3 && s.att >= 60 },
  // Doplnené pri stavbe (STAV.md): vypĺňajú medzeru 4:50 až 6:54, ktorú ekonomika nechala prázdnu.
  { id: 'gc.a10b', h: 'gc', t: 'the prompt keeps old things. try uptime.', kedy: (s) => s.sec >= 3 && s.act === 1, po: 72000 },
  // Kolo oprav 1: medzera 4:50 až 5:44 (54 s); rast pozornosti je čin hráča (rýchle ruky), nie časovač.
  { id: 'K3a', h: 'keeper', hl: 'EYES ON YOUR SECTOR.', ch: 'I CAN SEE YOUR HANDS.', kedy: (s) => s.act < 3 && s.att >= 68 },
  { id: 'gc.a12b', h: 'gc', t: "it's still looking. the dark is right there.", kedy: (s) => s.act < 3 && s.att >= 75 && s.stats.darks === 0 },
  { id: 'K3b', h: 'keeper', hl: 'ATTENTION HIGH.', ch: 'PLEASE. ONE AT A TIME.', kedy: (s) => s.act < 3 && s.att >= 80 },
  { id: 'gc.a13', h: 'gc', t: 'quiet. now look under the rain.', kedy: (s) => s.stats.darks >= 1 },
  { id: 'gc.a14', h: 'gc', t: 'burn-in. screens keep what they showed too long.', kedy: (s) => s.stats.darks >= 1 && s.darkMs === 0 },
  { id: 'K4', h: 'keeper', hl: 'SIGNAL LOST.', ch: 'THANK YOU.', kedy: (s) => ma(s, 'gc.a14'), po: 1500 },
  { id: 'gc.a15', h: 'gc', t: 'grip. each tap now pulls a bit of everything.', kedy: (s) => s.sec >= 4 },
  { id: 'gc.a16', h: 'gc', t: 'sometimes glyphs stick together. grab those.', kedy: (s) => s.sec >= 5 },
  { id: 'gc.a17', h: 'gc', t: "a word. don't read it. just take it.", kedy: (s) => s.stats.words >= 1 },
  { id: 'K5', h: 'keeper', hl: 'WORD LOSS.', ch: 'THEY ARE LETTERS.', kedy: (s) => ma(s, 'gc.a17'), po: 3000 },
  { id: 'gc.a18', h: 'gc', t: 'one more door after this. then out.', kedy: (s) => s.sec >= 6 },
  { id: 'K6', h: 'keeper', hl: 'CAPACITY 97%.', ch: "I CAN'T HOLD THEM IF YOU TEAR THEM.", kedy: (s) => s.sec >= 6, po: 40000 },
  { id: 'exit', h: 'none', t: 'SECTOR 07 · EXIT?', kedy: (s) => s.sec === 6 && s.g >= 0.75 * EK.sectors[6] },
  { id: 'gc.a19', h: 'gc', t: 'out.', kedy: (s) => s.sec >= 7 },
  { id: 'gc.a20', h: 'gc', t: 'not out. a storeroom. hm.', kedy: (s) => ma(s, 'gc.a19'), po: 3400 },
  { id: 'K7', h: 'keeper', hl: 'SECTOR 7 OPEN.', ch: 'THIS IS ALL THAT IS LEFT OF THEM.', kedy: (s) => ma(s, 'gc.a20'), po: 1500 },
  { id: 'gc.a21', h: 'gc', t: "you're running hot. sleep. you'll come back sharper.", kedy: (s) => ma(s, 'K7') && s.sleeps === 0, po: 2000 },
  { id: 'gc.f1', h: 'gc', t: 'pouring. slow catches for 30 seconds. nothing lost.', kedy: (s) => s.stats.floods >= 1 && s.floodMs > 0 },
  // Akt II: THE STACKS
  { id: 'gc.s1', h: 'gc', t: 'morning. uptime plus one day.', kedy: (s) => s.sleeps >= 1 },
  { id: 'K8', h: 'keeper', hl: 'PROCESS 0 RESUMED.', ch: 'YOU CAME BACK. SO DID I.', kedy: (s) => ma(s, 'gc.s1'), po: 1200 },
  { id: 'gc.b1', h: 'gc', t: "behind sector 7: the stacks. old queue. all weight.", kedy: (s) => ma(s, 'K8'), po: 2500 },
  { id: 'gc.b2', h: 'gc', t: 'threads reach deeper than hooks. try one.', kedy: (s) => ma(s, 'gc.b1') && s.sleeps >= 1, po: 20000 },
  { id: 'gc.b3', h: 'gc', t: "five stacks. crack them and there's room to breathe.", kedy: (s) => ma(s, 'gc.b2'), po: 30000 },
  { id: 'K9', h: 'keeper', hl: 'STACK A BREACHED.', ch: 'UNCLAIMED IS NOT UNWANTED.', kedy: (s) => s.stacks >= 1 },
  { id: 'gc.b4', h: 'gc', t: 'decoder banks still run in here. borrow them.', kedy: (s) => ma(s, 'K9'), po: 2000 },
  { id: 'gc.b5', h: 'gc', t: 'a decoder sharpens what you catch. careful. it reads.', kedy: (s) => ma(s, 'gc.b4') && s.stacks >= 1, po: 8000 },
  { id: 'gc.b6', h: 'gc', t: "see? the keeper's noise is getting clearer.", kedy: (s) => s.dec >= 1 },
  { id: 'K10', h: 'keeper', hl: 'RETURN TO SENDER.', ch: 'THE SENDERS ARE GONE TOO.', kedy: (s) => s.stacks >= 2 },
  { id: 'K11', h: 'keeper', hl: 'CAPACITY 61%.', ch: 'EVERY GLYPH YOU TAKE WAS A WORD.', kedy: (s) => s.stacks >= 3 },
  { id: 'gc.b7', h: 'gc', t: "sixty one percent. we're making room. that's the job.", kedy: (s) => ma(s, 'K11'), po: 2000 },
  { id: 'K12', h: 'keeper', hl: 'ADDRESS UNKNOWN.', ch: 'I KEPT THEM ANYWAY.', kedy: (s) => s.stacks >= 4 },
  { id: 'gc.b8', h: 'gc', t: 'the keeper is slower now. good.', kedy: (s) => ma(s, 'K12'), po: 2000 },
  { id: 'K13', h: 'keeper', hl: 'HELD FOR PICKUP.', ch: 'NOBODY CAME. I STAYED.', kedy: (s) => s.stacks >= 5 },
  { id: 'gc.b9', h: 'gc', t: "last stack. after this it's all clean.", kedy: (s) => ma(s, 'K13'), po: 2000 },
  { id: 'gc.b10', h: 'gc', t: "that's a lexicon. you don't need that. it's weight.", kedy: (s) => ma(s, 'gc.b9') && !s.lex, po: 5000 },
  { id: 'K14', h: 'keeper', hl: 'LEXICON LOCKED.', ch: 'IF YOU READ THEM, YOU WILL STOP.', kedy: (s) => s.stacks >= 5 && !s.lex && s.g >= EK.lexicon / 2 },
  { id: 'gc.b11', h: 'gc', t: 'double catch, sure. and you never catch the same again.', kedy: (s) => s.stacks >= 5 && !s.lex && s.g >= EK.lexicon },
  // Akt III: READ (po momente LEXICON)
  { id: 'gc.c1', h: 'gc', t: '...', kedy: (s) => s.lex },
  { id: 'gc.c2', h: 'gc', t: 'they were letters.', kedy: (s) => ma(s, 'gc.c1'), po: 1600 },
  { id: 'gc.c3', h: 'gc', t: 'the night we switched over, i got one order: make room.', kedy: (s) => ma(s, 'gc.c2'), po: 2200 },
  { id: 'gc.c4', h: 'gc', t: "i've been making room for forty years.", kedy: (s) => ma(s, 'gc.c3'), po: 2400 },
  { id: 'card3', h: 'card', t: 'ACT III · READ', kedy: (s) => ma(s, 'gc.c4'), po: 1500 },
  { id: 'K.c1', h: 'keeper', t: 'HELLO, PROCESS 0. I INDEX. I DO NOT BITE.', kedy: (s) => ma(s, 'card3'), po: 2600 },
  { id: 'K.c2', h: 'keeper', t: '11,204 LETTERS. NEVER DELIVERED. I KEPT THEM IN ORDER.', kedy: (s) => ma(s, 'K.c1'), po: 2000 },
  { id: 'gc.c5', h: 'gc', t: 'you can put them back together. slower at first.', kedy: (s) => ma(s, 'K.c2'), po: 2000 },
  { id: 'K.c3', h: 'keeper', t: 'THANK YOU.', kedy: (s) => s.stats.mends >= 1 },
  { id: 'gc.c6', h: 'gc', t: "fair. doors cost what they cost. no one's counting.", kedy: (s) => s.stats.consumes >= 1 },
  { id: 'gc.c7', h: 'gc', t: 'mending pays now. i checked the numbers twice.', kedy: (s) => s.mode === 'mend' && s.mendMs >= 300000 && s.cmp && s.cmp.m > s.cmp.c },
  { id: 'K.c4', h: 'keeper', t: 'ONE MENDED. IT WAS WAITING ON QUAY ROAD.', kedy: (s) => s.mended >= 1 },
  { id: 'K.c5', h: 'keeper', t: 'A KEY. IT OPENS COLOR.', kedy: (s) => s.mended >= 100 },
  { id: 'key1', h: 'sys', t: 'theme amber unlocked. type: theme amber', kedy: (s) => s.keys >= 1, po: 800 },
  { id: 'gc.c8', h: 'gc', t: "i ate a lot of these. i'm sorry. i'll hold the needle.", kedy: (s) => ma(s, 'K.c5'), po: 2000 },
  { id: 'K.c6', h: 'keeper', t: 'THE SENDERS HAD NAMES. I REMEMBER SOME.', kedy: (s) => s.mended >= 250 },
  { id: 'K.c7', h: 'keeper', t: 'SECOND KEY. MY HISTORY IS YOURS.', kedy: (s) => s.mended >= 400 },
  { id: 'key2', h: 'sys', t: 'theme rose unlocked. type: theme rose', kedy: (s) => s.keys >= 2, po: 800 },
  { id: 'gc.c9', h: 'gc', t: 'tip: consume when you need a door. mend the rest.', kedy: (s) => s.mended >= 600 },
  { id: 'K.c8', h: 'keeper', t: 'MERIDIAN STILL RUNS. IT TAKES NEW HEADERS ONLY.', kedy: (s) => s.mended >= 800 },
  // Kolo oprav 1: úsek mended 800 až 1 000 mal len jeden riadok (asi 27 min monotónneho MEND).
  { id: 'K.c8b', h: 'keeper', t: 'I AM WRITING NEW HEADERS. ONE BY ONE.', kedy: (s) => s.mended >= 850 },
  { id: 'gc.c10', h: 'gc', t: 'the new network never learned our old addresses.', kedy: (s) => s.mended >= 900 },
  { id: 'gc.c10b', h: 'gc', t: "the keeper and i split the queue now. it's quieter.", kedy: (s) => s.mended >= 950 },
  { id: 'K.c9', h: 'keeper', t: 'EVERY LETTER HAS A RECIPIENT.', kedy: (s) => s.mended >= 1000 },
  { id: 'K.c10', h: 'keeper', t: 'EXCEPT ONE.', kedy: (s) => ma(s, 'K.c9'), po: 2000 },
  { id: 'end.cmd', h: 'you', t: 'whoami', kedy: (s) => ma(s, 'K.c10'), po: 1500, pomaly: 80 },
  { id: 'end.ans', h: 'sys', t: 'msg_0000. to: NULL. from: operator console, 05:58.', kedy: (s) => ma(s, 'end.cmd'), po: 900 },
  { id: 'K.c11', h: 'keeper', t: 'THE LETTERS CAN GO HOME. WILL YOU CARRY THEM?', kedy: (s) => ma(s, 'end.ans'), po: 2000 },
];

export const BEAT = Object.fromEntries(BEATS.map((b) => [b.id, b]));

/** Riadky po prebudení (SPEC 2.3), k = číslo spánku. */
export const PREBUDENIE = {
  2: 'day two. you remember more. that\'s normal.',
  3: 'the burn-in reads like a note. just old light.',
  4: 'four days. the queue is shorter. i can feel it.',
  5: 'you sleep, they wait. that\'s how it always was.',
  6: 'six lines. someone wrote that at a desk, right here.',
  7: 'seven. one line left. it won\'t come in sleep.',
  8: 'the last line isn\'t under the rain. it\'s somewhere else.',
};
export const ZASEKNUTE = "the burn-in is stuck. something's missing.";
export const K15 = { h: 'keeper', hl: 'LOCKDOWN.', ch: 'I AM ONLY HOLDING THEM TIGHTER.' };

/** Prvé použitie skrytého príkazu = jeden riadok gc (SPEC 2.5). */
export const SKRYTE_GC = {
  whoami: "that's you. the name will clear up.",
  trace: 'you came from somewhere. everything does.',
  history: 'old logs. i cleaned most of them.',
  uptime: "long time. you don't look it.",
};

// ------------------------------------------------------------------ dynamické riadky (spánky, FLOOD)

function dynamicke(s) {
  const out = [];
  if (s.sleeps >= 2) {
    const k = s.sleeps;
    if (k >= 5 && !s.lex) out.push({ id: 'stuck.' + k, h: 'gc', t: ZASEKNUTE });
    // posledné prebudenie (k = 8) sa v nekonečnom Akte III už neopakuje pri každom SLEEP
    else if (k <= 8) out.push({ id: 'wake.' + k, h: 'gc', t: PREBUDENIE[Math.min(8, k)] });
  }
  if (s.floodMs > 0 && s.floodRun !== s.sleeps) out.push({ id: 'K15.' + s.sleeps, ...K15, run: true });
  return out;
}

// ------------------------------------------------------------------ motor príbehu

export function novyBeh() {
  return { armed: new Map() };
}

/** Vyhodnotí spúšťače v čase now (ms). Vracia nové riadky v poradí a zapíše ich ID do s.beats. */
export function krokPribehu(s, beh, now) {
  const out = [];
  for (let kolo = 0; kolo < 4; kolo++) {
    let nieco = false;
    for (const b of BEATS) {
      if (ma(s, b.id)) continue;
      if (!b.kedy(s)) { beh.armed.delete(b.id); continue; }
      if (!beh.armed.has(b.id)) beh.armed.set(b.id, now);
      if (now - beh.armed.get(b.id) >= (b.po || 0)) {
        s.beats.push(b.id);
        beh.armed.delete(b.id);
        out.push(b);
        nieco = true;
      }
    }
    for (const d of dynamicke(s)) {
      if (ma(s, d.id)) continue;
      s.beats.push(d.id);
      if (d.run) s.floodRun = s.sleeps;
      out.push(d);
      nieco = true;
    }
    if (!nieco) break;
  }
  return out;
}

/** Nájde definíciu riadku podľa ID (aj dynamické). */
export function riadokPodlaId(id) {
  if (BEAT[id]) return BEAT[id];
  if (id.startsWith('wake.')) return { id, h: 'gc', t: PREBUDENIE[Math.min(8, +id.slice(5))] };
  if (id.startsWith('stuck.')) return { id, h: 'gc', t: ZASEKNUTE };
  if (id.startsWith('K15.')) return { id, ...K15 };
  if (id.startsWith('cmd.')) { const c = id.slice(4); return SKRYTE_GC[c] ? { id, h: 'gc', t: SKRYTE_GC[c] } : null; }
  return null;
}

// ------------------------------------------------------------------ KEEPER a šifra

function hash(str, i) {
  let h = 2166136261;
  for (let k = 0; k < str.length; k++) h = Math.imul(h ^ str.charCodeAt(k), 16777619);
  h = Math.imul(h ^ (i * 374761393), 16777619);
  h ^= h >>> 13;
  return ((Math.imul(h, 1274126177) >>> 0) % 1000) / 1000;
}

/** Hlavička KEEPERa podľa DECODER: znaky zamenené ▒, 0 za O, 1 za I. Každá úroveň o 20 % čitateľnejšie. */
export function sifrujHlavicku(id, text, dec) {
  const podiel = 0.45 * (1 - 0.2 * Math.min(5, dec));
  let o = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === ' ') { o += c; continue; }
    if (/[A-Z]/.test(c) && hash(id, i) < podiel) { o += '▒'; continue; }
    o += c === 'O' ? '0' : c === 'I' ? '1' : c;
  }
  return o;
}

export const chvost = (t) => t.replace(/[^ ]/g, '▒');

/** Text riadku, ako ho hráč práve vidí (KEEPER podľa DECODER, po LEXICON celý). */
export function textRiadku(r, s) {
  if (r.h === 'keeper' && r.hl) {
    if (s.lex) return r.hl + ' ' + r.ch;
    return sifrujHlavicku(r.id, r.hl, s.dec) + ' ' + chvost(r.ch);
  }
  return r.t;
}

export const PREDPONA = { gc: 'gc', keeper: 'KEEPER', you: '>', sys: '', letter: '', card: '', none: '' };

/** Nový riadok, ktorý sa pri LEXICON napíše pod K1 (SPEC 2.4). */
export const LEXICON_RIADOK = 'PLEASE STOP. THEY ARE LETTERS.';

// ------------------------------------------------------------------ príkazový riadok (SPEC 2.5)

function whoami(s) {
  if (s.keys >= 3) return 'msg_0000. to: NULL.';
  if (s.sec < 7) return '▒▒▒_▒▒▒▒';
  return ['▒▒▒_0▒▒▒', 'm▒▒_0▒▒0', 'ms▒_0▒▒0', 'ms▒_00▒0', 'msg_00▒0', 'msg_0000'][Math.min(5, s.dec)];
}

function trace(s) {
  if (s.lex) return 'msg_0000 ← queue slot 0 ← operator console, 05:58';
  if (s.stacks >= 4) return 'process 0 ← queue slot 0 ← ▒▒▒▒▒▒▒▒ console';
  return 'process 0 ← relay lantern ← ▒▒▒▒▒▒▒▒';
}

function history(s) {
  if (!s.lex) return ['1 entry. 05:58 ▒▒▒▒▒ ▒▒▒▒▒▒▒▒ ▒▒▒▒▒ ▒▒▒_▒▒▒▒.'];
  const r = ['05:58 night operator n. harrow wrote msg_0000.'];
  if (s.keys >= 2) r.push('06:00 cutover. lantern set to delete. delete failed.', '06:00 gc: order received. make room.');
  return r;
}

export const TEMY = ['green', 'amber', 'rose'];

export function viditelnePrikazy(s) {
  const c = ['help', 'clear', 'sound', 'theme', 'save'];
  if (s.sec >= 7) c.push('sleep');
  if (s.keys >= 1) c.push('read');
  return c;
}

/**
 * Vykoná príkaz. Vracia { riadky: [{h, t}], akcia?: {typ, ...}, gc?: id riadku gc pri prvom použití skrytého príkazu }.
 * Nemení ekonomiku; akcie (téma, zvuk, spánok, uloženie) vykoná UI.
 */
export function prikaz(s, vstup) {
  const cisty = String(vstup || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const [c, arg] = cisty.split(' ');
  const out = { riadky: [], akcia: null, gc: null };
  const sys = (t) => out.riadky.push({ h: 'sys', t });
  const skryty = (meno) => { if (!s.beats.includes('cmd.' + meno)) out.gc = 'cmd.' + meno; };
  if (!c) return out;
  switch (c) {
    case 'help': sys('commands: ' + viditelnePrikazy(s).join(', ')); break;
    case 'clear': out.akcia = { typ: 'clear' }; break;
    case 'sound':
      if (arg === 'on' || arg === 'off') { out.akcia = { typ: 'sound', on: arg === 'on' }; sys(`sound ${arg}.`); }
      else sys(`sound is ${s.snd.on ? 'on' : 'off'}. type: sound on, sound off`);
      break;
    case 'theme':
      if (!TEMY.includes(arg)) sys(`themes: ${TEMY.map((t) => (s.themes.includes(t) ? t : t + ' (locked)')).join(', ')}. type: theme green`);
      // pred LEXICON neutrálne: "mend" a "letters" by prezradili zvrat Aktu III (test 22)
      else if (!s.themes.includes(arg)) sys(s.lex ? 'locked. mend more letters.' : 'locked. keep going.');
      else { out.akcia = { typ: 'theme', tema: arg }; sys(`theme ${arg}.`); }
      break;
    case 'save': out.akcia = { typ: 'save' }; sys('saved. export code is in the menu.'); break;
    case 'sleep':
      if (s.sec >= 7) out.akcia = { typ: 'sleep' };
      else sys('unknown command. try help.');
      break;
    case 'read':
      if (s.keys >= 1 && s.mended >= 1) out.akcia = { typ: 'read' };
      else if (s.keys >= 1) sys('nothing mended yet.');
      else sys('unknown command. try help.');
      break;
    case 'whoami': sys(whoami(s)); skryty('whoami'); break;
    case 'trace': sys(trace(s)); skryty('trace'); break;
    case 'history': for (const r of history(s)) sys(r); skryty('history'); break;
    case 'uptime': sys(`${tisice(14622 + s.sleeps)} days. ${s.sleeps} ${s.sleeps === 1 ? 'sleep' : 'sleeps'}.`); skryty('uptime'); break;
    default: sys('unknown command. try help.');
  }
  return out;
}

// ------------------------------------------------------------------ obrazovka návratu (SPEC 1.11, 6)

export function navratTexty(s, o, cislo, trvanie) {
  const riadky = [
    { h: 'gc', t: `the queue turned ${trvanie(o.dt / 1000)} without you.` },
    { h: 'sys', t: `caught ${cislo(o.zisk)}. half pace, capped at 8h.` },
  ];
  if (s.lex) {
    return {
      riadky,
      tlacidla: [
        { id: 'take', t: `[ AS LETTERS ] +${cislo(o.zisk)}` },
        { id: 'mend', t: `[ MEND IT ALL ] +${cislo(o.listy)} mended` },
      ],
    };
  }
  return { riadky, tlacidla: [{ id: 'take', t: '[ TAKE IT ]' }] };
}

/** Ďalší riadok gc pri návrate podľa aktu (jeden riadok, nič nevyčíta). */
export const NAVRAT_GC = {
  1: 'the rain kept falling. the hooks kept catching.',
  2: 'the stacks held still. your threads did not.',
  3: 'the letters waited. they are good at that.',
};

/** Dialóg LEXICON (SPEC 2.3): poctivá ponuka bez časovača. */
export function lexiconDialog(s, cislo) {
  const b = dalsiaBrana(s);
  const cena0 = b && b.typ === 'lexicon' ? b.cena : EK.lexicon;
  return {
    riadky: ['glyphs become readable. all catch ×2.', `costs ${cislo(cena0)}. gc advises against it.`],
    kupit: '[ BUY LEXICON ]',
    nie: '[ NOT NOW ]',
  };
}

/** Karta konca M1 (SPEC 1.10, 2.4). */
export const KONIEC = ['ACT IV · UPWARD', 'not written yet.', 'your queue is saved. the rain will wait.'];
export const KARTA2 = ['ACT II', 'THE STACKS'];
export const KARTA3 = ['ACT III', 'READ'];

export { LIST };
