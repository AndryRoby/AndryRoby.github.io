export const unik = s => s.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
export const slova = s => [...s.matchAll(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu)]
  .map(m => ({ text: m[0], od: m.index, do: m.index + m[0].length }));

// UTF-16 intervaly smerujú do pôvodného vstupu, koniec je exkluzívny.
export function normalizuj(original) {
  let text = '';
  const od = [], konce = [];
  for (const m of original.matchAll(/\r\n|[\u1100-\u11ff\uac00-\ud7a3]+\p{M}*|[^\r]\p{M}*|\r/gu)) {
    const s = m[0].normalize('NFC').replace(/\r\n/g, '\n').replace(/[’‘]/g, "'");
    text += s;
    for (let i = 0; i < s.length; i++) {
      od.push(m.index);
      konce.push(m.index + m[0].length);
    }
  }
  return { text, rozsah: (a, b) => ({ od: od[a] ?? original.length, do: konce[b - 1] ?? original.length }) };
}

const orez = (text, od, koniec) => {
  while (od < koniec && /\s/u.test(text[od])) od++;
  while (koniec > od && /\s/u.test(text[koniec - 1])) koniec--;
  return { text: text.slice(od, koniec), od, do: koniec };
};

export function odseky(text) {
  let oddelovac = /\n\s*\n/g;
  if (!/\n\s*\n/.test(text) && text.split('\n').length >= 3) oddelovac = /\n/g;
  const out = [];
  let od = 0;
  for (const m of text.matchAll(oddelovac)) {
    out.push(orez(text, od, m.index));
    od = m.index + m[0].length;
  }
  out.push(orez(text, od, text.length));
  return out.filter(p => p.text);
}

export function vety(text, jazyk, posun = 0) {
  const chranene = new Set();
  const chran = re => {
    for (const m of text.matchAll(re)) {
      for (let i = m.index; i < m.index + m[0].length; i++) chranene.add(i);
    }
  };
  for (const s of jazyk.SKRATKY) {
    chran(new RegExp('(?<![\\p{L}\\p{N}])' + unik(s).replace(/ /g, '\\s+'), 'giu'));
  }
  chran(/\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}/gu);
  chran(/\d+[.,]\d+/gu);
  const out = [];
  let start = 0;
  for (const m of text.matchAll(/[.!?…]+["'“”«»‚‘)]*(?=\s+(?:[\p{Lu}\p{N}"'„“«‚‘]))/gu)) {
    if (chranene.has(m.index)) continue;
    const end = m.index + m[0].length;
    const p = orez(text, start, end);
    if (slova(p.text).length) out.push({ ...p, od: p.od + posun, do: p.do + posun });
    start = end;
  }
  const p = orez(text, start, text.length);
  if (slova(p.text).length) out.push({ ...p, od: p.od + posun, do: p.do + posun });
  return out;
}

export function priprav(text, jazyk) {
  const povodne = odseky(text);
  const prvy = povodne[0];
  const nadpis = prvy && slova(prvy.text).length <= 12 && !/[.!?]["'“”»]*$/u.test(prvy.text) ? prvy : null;
  let telo = povodne.slice(nadpis ? 1 : 0);
  const slovaTela = telo.flatMap(p => slova(p.text).map(w => ({ ...w, od: w.od + p.od, do: w.do + p.od })));
  const orezane = slovaTela.length > 5000;
  const koniec = orezane ? slovaTela[4999].do : text.length;
  telo = telo.filter(p => p.od < koniec).map(p => ({ ...p, do: Math.min(p.do, koniec), text: text.slice(p.od, Math.min(p.do, koniec)) }));
  const vsetky = [], rytmus = [], dlzkyOdsekov = [];
  for (const p of telo) {
    let skupina = [], pocet = 0, offset = p.od;
    const vloz = () => {
      if (!skupina.length) return;
      const vs = vety(skupina.map(x => x.text).join('\n'), jazyk, skupina[0].od);
      vsetky.push(...vs);
      rytmus.push(...vs);
      pocet += vs.reduce((s, v) => s + slova(v.text).length, 0);
      skupina = [];
    };
    for (const riadok of p.text.split('\n')) {
      if (/^\s*(?:[-*•]|\d+[.)])\s/u.test(riadok)) {
        vloz();
        vsetky.push(...vety(riadok, jazyk, offset));
      } else skupina.push({ text: riadok, od: offset });
      offset += riadok.length + 1;
    }
    vloz();
    if (pocet) dlzkyOdsekov.push(pocet);
  }
  return { nadpis, telo, vsetky, rytmus, dlzkyOdsekov, slova: slovaTela.slice(0, 5000), orezane, povodneSlov: slovaTela.length, koniec };
}

export function odhadJazyka(text, jazyky) {
  const prvy = odseky(text)[0];
  const nadpis = prvy && slova(prvy.text).length <= 12 && !/[.!?]["'“”»]*$/u.test(prvy.text);
  const words = slova(nadpis ? text.slice(prvy.do) : text).map(w => w.text.toLowerCase());
  if (words.length < 30) return null;
  const skore = Object.entries(jazyky).map(([id, j]) => {
    const slovnik = new Set(j.FUNKCNE.slice(0, 40).map(x => x.toLowerCase()));
    const znaky = { sk: /[äôĺľŕ]/giu, cs: /[řěů]/giu, de: /[ßü]/giu }[id];
    return [id, words.filter(w => slovnik.has(w)).length + (znaky ? (text.match(znaky) || []).length * 5 : 0)];
  }).sort((a, b) => b[1] - a[1]);
  return skore[0][1] > (skore[1]?.[1] ?? 0) ? skore[0][0] : null;
}
