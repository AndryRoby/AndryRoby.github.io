/*
 * Výsledok kontroly e-mailom (súhlas vysledok-v1, relácia 205, ops/druhy-ucet/205/SPEC.md časti 1, 3, 5).
 * Čisté funkcie bez DOM: texty bloku a stránky potvrdenia (SK, EN, DE, CS), overenie adresy, zhrnutie výsledku podľa bielych
 * zoznamov, telo požiadavky, mapovanie odpovedí workera feed-monitor na stavy, čítanie kľúča z fragmentu, adresa API.
 * Používajú ich vysledok-email.js (blok pod výsledkom troch nástrojov) a potvrdit/potvrdit.js (stránka /vysledok/potvrdit/).
 *
 * Texty súhlasu sú archivované v ops/druhy-ucet/205/pravo/SUHLAS-VYSLEDOK.md so SHA-256; vysledok.test.mjs ich porovná.
 * Zmena jediného znaku v texte súhlasu po zverejnení = nová verzia (vysledok-v2), nový záznam v archíve.
 * Do tela požiadavky ide len to, čo vymenúva SPEC časť 3 (kódy, stavy, počty, pri kontrole e-shopu pôvod obchodu); nikdy
 * správa nálezu, hodnota, xpath, názov súboru ani iný text zo vstupu. Funkcie pri zlom vstupe vracajú null (zlyhanie zatvára:
 * blok sa vtedy neukáže a nič sa neodošle).
 */

export const SUHLAS = 'vysledok-v1';
export const NASTROJE = Object.freeze(['agent-ready', 'efaktura', 'sepa']);
export const JAZYKY = Object.freeze({
  'agent-ready': Object.freeze(['sk', 'en', 'de']),
  efaktura: Object.freeze(['sk', 'en', 'de', 'cs']),
  sepa: Object.freeze(['sk', 'en', 'de']),
});
export const JAZYKY_STRANKY = Object.freeze(['sk', 'en', 'de', 'cs']);
export const CASOVY_LIMIT_MS = 15000;

// Adresa API: na arling.sk worker feed-monitor, pri 127.0.0.1 a localhost tá istá cesta na tom istom serveri (vzor odber-ar.js),
// aby sa dali robiť snímky so simulovaným workerom a platilo CSP 'self'.
export function adresaApi(loc, cesta) {
  const host = loc && typeof loc.hostname === 'string' ? loc.hostname : '';
  const lokalne = host === '127.0.0.1' || host === 'localhost';
  return (lokalne ? String(loc.origin) + '/feed-monitor' : 'https://feed-monitor.arling.workers.dev') + cesta;
}

/** Je nástroj a jazyk z bieleho zoznamu? */
export const platnyNastroj = (n) => typeof n === 'string' && NASTROJE.includes(n);
export const platnyJazyk = (n, j) => platnyNastroj(n) && typeof j === 'string' && JAZYKY[n].includes(j);

// Rovnaké pravidlo ako platnyEmail v feed-doctor/agent-ready/straz.mjs (najviac 254 znakov, jeden @, doména s bodkou, bez
// medzier a znakov < > "), navyše bez riadiacich znakov. Vstup sa prijme voľne (medzery okolo, veľké písmená), výstup je presný.
const EMAIL_RE = /^[^@\s<>"]+@[^@\s<>".]+(?:\.[^@\s<>".]+)+$/;
// Navyše pravidlo mailera (products/subscribe-service/app.py EMAIL_RE) a SMTP, rovnaké ako cistaAdresa vo workeri (O1 po
// V1 N3, V3 V2, V4-3): pred @ len písmená bez diakritiky, číslice a ._%+-, bez bodky na kraji a dvoch za sebou; doména zo
// štítkov písmen, číslic a pomlčiek bez pomlčky na kraji, posledný štítok aspoň 2 písmená. Adresu, ktorú by mailer odmietol,
// človek opraví hneď (chyba zla alebo tvar), nie po „e-mail sa nepodarilo odoslať“.
const ADRESA_MAILERA = /^[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
// Znaky, ktoré mailer pred @ prijme (bez ohľadu na bodky na kraji a dve za sebou, to je preklep).
const ZNAKY_PRED_ZAVINACOM = /^[a-z0-9_%+.-]+$/;
// eslint-disable-next-line no-control-regex
const RIADIACE = /[\u0000-\u001f\u007f-\u009f]/;
export function normalizujEmail(vstup) {
  if (typeof vstup !== 'string') return null;
  const s = vstup.trim().toLowerCase();
  if (!s || s.length > 254 || RIADIACE.test(s) || !EMAIL_RE.test(s) || !ADRESA_MAILERA.test(s)) return null;
  return s;
}

/** Kľúč chyby pre adresu, ktorú normalizujEmail neprijme (O3a, brána 205 O7, R73: pri chybe povedať hranicu):
 *  'tvar', keď má adresa tvar e-mailu (pravidlo straz.mjs), ale pred @ znak, ktorý mailer neprijme (diakritika, apostrof,
 *  &, čiarka a pod.), aj keď vadí aj doména (veta ukáže skutočnú hranicu pred @); inak 'zla' (bežný preklep: chýba @, bodka
 *  v doméne, medzera, bodka na kraji alebo dve za sebou; aj doména s diakritikou pri čistej časti pred @, na tú veta tvar
 *  nesedí). Pre adresu, ktorá prejde, vráti null. */
export function chybaAdresy(vstup) {
  if (normalizujEmail(vstup) !== null) return null;
  if (typeof vstup !== 'string') return 'zla';
  const s = vstup.trim().toLowerCase();
  if (!s || s.length > 254 || RIADIACE.test(s) || !EMAIL_RE.test(s)) return 'zla';
  return ZNAKY_PRED_ZAVINACOM.test(s.slice(0, s.indexOf('@'))) ? 'zla' : 'tvar'; // EMAIL_RE pripustí práve jeden @
}

// ── Zhrnutie výsledku (SPEC časť 3): nové objekty len z vymenovaných polí ──
const cele = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const KOD_MALY = /^[a-z][a-z0-9_]{0,63}$/;
// Rovnaký regex ako EF_KOD workera (vysledok.mjs): XRechnung má kódy s malou príponou BR-DE-23-a až BR-DE-25-b a
// BR-DE-CVD-06-a, -b; tie musia prísť v oficiálnom zápise, inak e-mail stratí normatívne znenie (O1 po V1 N1, V3 V3).
const KOD_EF = /^(?=.{2,40}$)[A-Z][A-Z0-9-]*(?:-[a-z])?$/;
const HOST = /^(?=.{1,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

/** Pôvod obchodu https://<host>/ alebo null (https, bez mena a hesla, hostiteľ písmená, číslice, pomlčky a bodky). */
export function povodObchodu(vstup) {
  if (typeof vstup !== 'string' || vstup.length > 2048) return null;
  let u;
  try { u = new URL(vstup); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const h = u.hostname.toLowerCase();
  if (!HOST.test(h) || h.split('.').some((c) => !c || c.startsWith('-') || c.endsWith('-'))) return null;
  return 'https://' + h + '/';
}

function zoznam(pole, max, prevod) {
  if (!Array.isArray(pole)) return null;
  const out = [], videne = new Set();
  for (const x of pole) {
    const y = prevod(x);
    if (y == null) continue;
    const kluc = JSON.stringify(y);
    if (videne.has(kluc)) continue;
    videne.add(kluc);
    out.push(y);
    if (out.length >= max) break;
  }
  return out;
}

const ciselnyAleboNull = (v) => (v === null || v === undefined ? null : cele(v, 0, 100) ? v : undefined);

function zhrnutieAgentReady(v) {
  const obchod = povodObchodu(v.obchod);
  if (!obchod) return null;
  const skore = ciselnyAleboNull(v.skore), pokrytie = ciselnyAleboNull(v.pokrytie);
  if (skore === undefined || pokrytie === undefined) return null;
  const pravidla = zoznam(v.pravidla ?? [], 27, (k) => (typeof k === 'string' && KOD_MALY.test(k) ? k : null));
  const eu = zoznam(v.eu ?? [], 3, (e) => (e && typeof e.kod === 'string' && KOD_MALY.test(e.kod) && typeof e.stav === 'string' && KOD_MALY.test(e.stav)
    ? { kod: e.kod, stav: e.stav } : null));
  if (!pravidla || !eu) return null;
  return { obchod, skore, pokrytie, pravidla, eu };
}

const PROFILY = ['en16931', 'peppol', 'xrechnung', 'neznamy'], TYPY = ['Invoice', 'CreditNote', 'CII'];
const ZAVAZNOST_EF = ['chyba', 'varovanie', 'informacia'];
function zhrnutieEfaktura(v) {
  if (!PROFILY.includes(v.profil) || !TYPY.includes(v.typ)) return null;
  if (![v.chyby, v.varovania, v.informacie].every((x) => cele(x, 0, 1000))) return null;
  const pravidla = zoznam(v.pravidla ?? [], 60, (p) => (p && typeof p.kod === 'string' && KOD_EF.test(p.kod) && ZAVAZNOST_EF.includes(p.zavaznost) && cele(p.pocet, 1, 1000)
    ? { kod: p.kod, zavaznost: p.zavaznost, pocet: p.pocet } : null));
  if (!pravidla) return null;
  return { profil: v.profil, typ: v.typ, chyby: v.chyby, varovania: v.varovania, informacie: v.informacie, pravidla };
}

const STAVY_SEPA = ['pass', 'warn', 'fail'], BANKY = ['tatrabanka', 'slsp', 'vub', 'csob', 'generic'], ZAVAZNOST_SEPA = ['high', 'medium', 'low'];
function zhrnutieSepa(v) {
  if (!STAVY_SEPA.includes(v.stav) || !BANKY.includes(v.banka)) return null;
  if (![v.transakcie, v.adresy_zle, v.adresy_spolu].every((x) => cele(x, 0, 100000)) || v.adresy_zle > v.adresy_spolu) return null;
  const nalezy = zoznam(v.nalezy ?? [], 70, (n) => (n && typeof n.kod === 'string' && KOD_MALY.test(n.kod) && ZAVAZNOST_SEPA.includes(n.zavaznost) && cele(n.pocet, 1, 10000)
    ? { kod: n.kod, zavaznost: n.zavaznost, pocet: n.pocet } : null));
  if (!nalezy) return null;
  return { stav: v.stav, banka: v.banka, transakcie: v.transakcie, adresy_zle: v.adresy_zle, adresy_spolu: v.adresy_spolu, nalezy };
}

/** Zhrnutie výsledku pre nástroj podľa SPEC časť 3, alebo null. Neznáme polia sa nikdy neprenesú. */
export function zhrnutie(nastroj, vysledok) {
  if (!platnyNastroj(nastroj) || !vysledok || typeof vysledok !== 'object' || Array.isArray(vysledok)) return null;
  if (nastroj === 'agent-ready') return zhrnutieAgentReady(vysledok);
  if (nastroj === 'efaktura') return zhrnutieEfaktura(vysledok);
  return zhrnutieSepa(vysledok);
}

/** Telo POST /v1/vysledok. email musí byť už normalizovaný (normalizujEmail). */
export function teloPoziadavky({ email, nastroj, jazyk, zhrnutie: z, hp }) {
  return { email, nastroj, jazyk, suhlas: SUHLAS, vysledok: z, hp: typeof hp === 'string' ? hp.slice(0, 200) : '' };
}

// ── Odpovede workera na stavy (SPEC 2.2, 2.3, 5.3) ──
export const DOVODY = Object.freeze(['zla', 'limit', 'strop', 'mail', 'siet', 'server', 'vypnute']);

/** Stav bloku po odpovedi POST /v1/vysledok: 'ok' alebo kľúč chyby (zla, limit, strop, mail, server, vypnute). */
export function stavOdoslania(status, data) {
  const err = data && typeof data.error === 'string' ? data.error : '';
  if (status === 200) return data && data.ok === true ? 'ok' : 'server';
  if (status === 400) return err === 'invalid' && data.pole && data.pole !== 'email' ? 'server' : 'zla';
  if (status === 429) return 'limit';
  if (status === 502) return 'mail';
  if (status === 503) return err === 'strop' ? 'strop' : err === 'not_available' ? 'vypnute' : 'server';
  return 'server';
}
/** Dôvod pre Umami odber_vysledok_chyba (časový limit sa ráta ako siet, adresa so znakmi, ktoré mailer neprijme, ako zla:
 *  zoznam dôvodov SPEC 5.2 ostáva bez zmeny). */
export const dovodChyby = (stav) => (stav === 'cas' ? 'siet' : stav === 'tvar' ? 'zla' : DOVODY.includes(stav) ? stav : 'server');

// ── Stránka potvrdenia ──
const K_RE = /^[0-9a-f]{32}\.[0-9a-f]{64}$/;
export const platnyKluc = (k) => typeof k === 'string' && K_RE.test(k);

/** Z fragmentu #k=<32 hex>.<64 hex>&j=<jazyk> urobí {k, j}; zlý alebo chýbajúci kľúč je null, neznámy jazyk sk. */
export function citajFragment(hash) {
  let k = null, j = 'sk';
  for (const cast of String(hash || '').replace(/^#/, '').split('&')) {
    const i = cast.indexOf('=');
    if (i < 1) continue;
    const nazov = cast.slice(0, i), hodnota = cast.slice(i + 1);
    if (nazov === 'k' && platnyKluc(hodnota)) k = hodnota;
    if (nazov === 'j' && JAZYKY_STRANKY.includes(hodnota)) j = hodnota;
  }
  return { k, j };
}

/** Má fragment parameter k (aj zlý alebo skrátený)? Bez neho ide o obnovenú stránku (kľúč sme z adresy už odstránili) alebo
 *  adresu bez odkazu z e-mailu: stránka vtedy povie, aby človek otvoril odkaz znova, nie „odkaz neplatí“ (O3a, brána O3). */
export const maKluc = (hash) => String(hash || '').replace(/^#/, '').split('&').some((c) => /^k(?:=|$)/.test(c));

/** Fragment, ktorý ostane v adrese po odstránení kľúča: len jazyk odkazu (en, de, cs), aby stránka po obnovení hovorila
 *  jazykom odkazu; slovenčina je predvolená, adresa ostane bez fragmentu. Kľúč nikdy. */
export const fragmentJazyka = (j) => (j !== 'sk' && JAZYKY_STRANKY.includes(j) ? '#j=' + j : '');

/** Stav stránky po odpovedi POST /v1/vysledok/potvrd: {stav, nastroj}. stav: odoslane, uz_odoslane, odosiela, neplatny, mail, limit, strop, server. */
export function stavPotvrdenia(status, data) {
  const nastroj = data && platnyNastroj(data.nastroj) ? data.nastroj : null;
  if (status === 200) {
    const s = data && data.ok === true ? data.stav : null;
    if (s === 'odoslane' || s === 'uz_odoslane' || s === 'odosiela') return { stav: s, nastroj };
    return { stav: 'server', nastroj: null };
  }
  if (status === 400) return { stav: 'neplatny', nastroj: null };
  if (status === 429) return { stav: 'limit', nastroj: null };
  if (status === 502) return { stav: 'mail', nastroj: null };
  // Denný strop e-mailov s výsledkom (O1 po V4-1): odkaz platí ďalej, tlačidlo ostane.
  if (status === 503 && data && data.error === 'strop') return { stav: 'strop', nastroj: null };
  return { stav: 'server', nastroj: null };
}
/** Stavy, po ktorých tlačidlo zmizne (nemá zmysel znova posielať). bez_kluca: adresa bez kľúča, tlačidlo sa ani neukáže. */
export const KONECNE_STAVY = Object.freeze(['odoslane', 'uz_odoslane', 'neplatny', 'bez_kluca']);
/** Stavy, po ktorých má stránka nadpis „Výsledok je na ceste“ (O3a, brána O4). */
export const HOTOVE_STAVY = Object.freeze(['odoslane', 'uz_odoslane']);

// Adresy nástrojov (SPEC časť 4, bez UTM: odkaz zo stránky hubu, nie z e-mailu).
const NASTROJ_URL = {
  'agent-ready': { sk: '/feed-doctor/agent-ready/sk/', en: '/feed-doctor/agent-ready/', de: '/feed-doctor/agent-ready/de/' },
  efaktura: { sk: '/efaktura/', en: '/efaktura/en/', de: '/efaktura/de/', cs: '/efaktura/cs/' },
  sepa: { sk: '/sepa-pain001-doctor/', en: '/sepa-pain001-doctor/en/', de: '/sepa-pain001-doctor/de/' },
};
export const adresaNastroja = (nastroj, jazyk) => (platnyNastroj(nastroj) ? NASTROJ_URL[nastroj][jazyk] || NASTROJ_URL[nastroj].sk : null);
// Zásady: sk a cs /privacy/, en /privacy/en/, de /privacy/de/ (CS zásady neexistujú, česká stránka odkáže na slovenské).
export const adresaZasad = (jazyk) => (jazyk === 'en' ? '/privacy/en/' : jazyk === 'de' ? '/privacy/de/' : '/privacy/') + '#vysledok-emailom';

// Spojovač slov (word joiner, U+2060) za spojovníkom v nemeckom „E-Mail“ vo vete súhlasu a v kickeri stránky potvrdenia
// (O3a, brána O5): riadok sa za „E-“ nezalomí (UAX 14, LB11), spojovník ostáva z nášho písma a znak je neviditeľný.
// Nie nezalomiteľný spojovník U+2011: písmo ARLing Sans ani náhrada Arial ho nemajú (cmap, 23. 10. 2026), prehliadač by
// ho vykreslil z iného písma (na Windows Segoe UI).
export const WJ = String.fromCharCode(0x2060);

// ── Texty bloku pod výsledkom (archív: SUHLAS-VYSLEDOK.md, bloky vysledok-v1/<jazyk>/<kľúč>) ──
// {adresa} v hotovoText dopĺňa vysledok-email.js ako samostatný textový uzol (textContent), nikdy cez HTML.
export const TEXTY = Object.freeze({
  sk: Object.freeze({
    nadpis: 'Poslať si výsledok e-mailom',
    uvodOprava: 'Výsledok neukladáme, po zatvorení stránky zmizne. Pošleme vám ho e-mailom aj s postupom opravy.',
    uvodNalezy: 'Výsledok neukladáme, po zatvorení stránky zmizne. Pošleme vám ho e-mailom so zoznamom nálezov.',
    uvodBezNalezov: 'Výsledok neukladáme, po zatvorení stránky zmizne. Pošleme vám ho e-mailom.',
    oddelenie: 'Kontrola e-mail nepotrebuje, poslanie je dobrovoľné.',
    pole: 'Váš e-mail',
    suhlas: 'Pošlite mi tento výsledok jedným e-mailom. Najprv mi príde odkaz na potvrdenie. Nič iné.',
    tlacidlo: 'Poslať si výsledok',
    odosiela: 'Posiela sa…',
    spravcaSubor: 'E-mail posiela ARLing s. r. o. (Bratislava) s vaším súhlasom (čl. 6 ods. 1 písm. a) GDPR). Uložíme len adresu a zhrnutie výsledku (kódy a počty), nikdy obsah súboru.',
    spravcaObchod: 'E-mail posiela ARLing s. r. o. (Bratislava) s vaším súhlasom (čl. 6 ods. 1 písm. a) GDPR). Uložíme len adresu a zhrnutie výsledku (kódy, počty a adresu obchodu), nikdy obsah stránok obchodu.',
    zasadyPred: 'Podrobnosti v ',
    zasady: 'zásadách ochrany súkromia',
    zasadyPo: '.',
    chyby: Object.freeze({
      zla: 'Chyba: toto nevyzerá ako e-mailová adresa. Skontrolujte preklep.',
      tvar: 'Chyba: túto adresu nevieme použiť. Pred @ môžu byť len písmená bez diakritiky, číslice a znaky . _ % + -',
      limit: 'Chyba: priveľa žiadostí z tejto siete alebo na túto adresu. Skúste to o hodinu; ak ste na túto adresu dnes už žiadali dvakrát, až zajtra.',
      strop: 'Dnes sme už poslali najviac e-mailov, koľko si dovolíme. Skúste to zajtra; výsledok si zatiaľ stiahnite alebo skopírujte.',
      mail: 'Chyba: e-mail sa nepodarilo odoslať. Skúste to o pár minút.',
      siet: 'Chyba: server sa nedá zasiahnuť. Adresa sa neodoslala. Skúste znova.',
      cas: 'Chyba: server neodpovedal včas. Ak do pár minút nepríde e-mail na potvrdenie, skúste znova.',
      server: 'Chyba: niečo sa pokazilo u nás. Skúste o pár minút.',
      vypnute: 'Posielanie výsledku je dočasne vypnuté. Výsledok si stiahnite alebo skopírujte.',
    }),
    hotovoNadpis: 'Skontrolujte schránku',
    hotovoText: 'Odkaz na potvrdenie sme poslali na {adresa}. Výsledok príde po kliknutí.',
    hotovoDrobne: 'Nič neprišlo do pár minút? Pozrite priečinok so spamom. Nepotvrdenú žiadosť zmažeme z našej databázy po 7 dňoch.',
    zmenit: 'Zmeniť adresu',
  }),
  en: Object.freeze({
    nadpis: 'Email yourself the result',
    uvodOprava: 'We do not store the result; it disappears when you close the page. We can email it to you with the steps to fix it.',
    uvodNalezy: 'We do not store the result; it disappears when you close the page. We can email it to you with the list of findings.',
    uvodBezNalezov: 'We do not store the result; it disappears when you close the page. We can email it to you.',
    oddelenie: 'The check needs no email. Sending the result is optional.',
    pole: 'Your email',
    suhlas: 'Email me this result in one email. Send me a confirmation link first. Nothing else.',
    tlacidlo: 'Email me the result',
    odosiela: 'Sending…',
    spravcaSubor: 'ARLing s. r. o. (Bratislava, Slovakia) sends this email with your consent (GDPR Art. 6(1)(a)). We store only your address and a summary of the result (codes and counts), never the content of your file.',
    spravcaObchod: 'ARLing s. r. o. (Bratislava, Slovakia) sends this email with your consent (GDPR Art. 6(1)(a)). We store only your address and a summary of the result (codes, counts and the store address), never the content of the store pages.',
    zasadyPred: 'Details in our ',
    zasady: 'privacy policy',
    zasadyPo: '.',
    chyby: Object.freeze({
      zla: 'Error: this does not look like an email address. Check for a typo.',
      tvar: 'Error: we cannot use this address. Before the @ we accept only letters without accents, digits and . _ % + -',
      limit: 'Error: too many requests from this network or for this address. Try again in an hour; if you have already asked twice today for this address, try tomorrow.',
      strop: 'We have sent as many emails today as we allow ourselves. Try again tomorrow; until then, download or copy the result.',
      mail: 'Error: the email could not be sent. Try again in a few minutes.',
      siet: 'Error: could not reach the server. Your address was not sent. Try again.',
      cas: 'Error: the server did not answer in time. If no confirmation email arrives within a few minutes, try again.',
      server: 'Error: something went wrong on our side. Try again in a few minutes.',
      vypnute: 'Sending the result is switched off for now. Download or copy the result instead.',
    }),
    hotovoNadpis: 'Check your inbox',
    hotovoText: 'We sent a confirmation link to {adresa}. The result comes after you click it.',
    hotovoDrobne: 'Nothing after a few minutes? Check your spam folder. We delete an unconfirmed request from our database after 7 days.',
    zmenit: 'Change address',
  }),
  de: Object.freeze({
    nadpis: 'Ergebnis per E-Mail erhalten',
    uvodOprava: 'Wir speichern das Ergebnis nicht, beim Schließen der Seite ist es weg. Wir senden es Ihnen per E-Mail, mit den Schritten zur Behebung.',
    uvodNalezy: 'Wir speichern das Ergebnis nicht, beim Schließen der Seite ist es weg. Wir senden es Ihnen per E-Mail, mit der Liste der Befunde.',
    uvodBezNalezov: 'Wir speichern das Ergebnis nicht, beim Schließen der Seite ist es weg. Wir senden es Ihnen per E-Mail.',
    oddelenie: 'Die Prüfung braucht keine E-Mail, der Versand ist freiwillig.',
    pole: 'Ihre E-Mail-Adresse',
    suhlas: `Senden Sie mir dieses Ergebnis in einer E-${WJ}Mail. Zuerst kommt ein Bestätigungslink. Sonst nichts.`,
    tlacidlo: 'Ergebnis per E-Mail senden',
    odosiela: 'Wird gesendet…',
    spravcaSubor: 'Die E-Mail versendet die ARLing s. r. o. (Bratislava, Slowakei) mit Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Wir speichern nur Ihre Adresse und eine Zusammenfassung des Ergebnisses (Codes und Anzahlen), nie den Inhalt Ihrer Datei.',
    spravcaObchod: 'Die E-Mail versendet die ARLing s. r. o. (Bratislava, Slowakei) mit Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Wir speichern nur Ihre Adresse und eine Zusammenfassung des Ergebnisses (Codes, Anzahlen und die Shop-Adresse), nie den Inhalt der Shop-Seiten.',
    zasadyPred: 'Einzelheiten in unserer ',
    zasady: 'Datenschutzerklärung',
    zasadyPo: '.',
    chyby: Object.freeze({
      zla: 'Fehler: Das sieht nicht wie eine E-Mail-Adresse aus. Bitte auf Tippfehler prüfen.',
      tvar: 'Fehler: Diese Adresse können wir nicht verwenden. Vor dem @ sind nur Buchstaben ohne Akzente, Ziffern und . _ % + - möglich.',
      limit: 'Fehler: Zu viele Anfragen aus diesem Netz oder für diese Adresse. Bitte in einer Stunde erneut versuchen; wenn Sie heute schon zweimal für diese Adresse angefragt haben, morgen.',
      strop: 'Wir haben heute schon so viele E-Mails gesendet, wie wir uns erlauben. Bitte morgen erneut versuchen; laden Sie das Ergebnis bis dahin herunter oder kopieren Sie es.',
      mail: 'Fehler: Die E-Mail konnte nicht gesendet werden. Bitte in ein paar Minuten erneut versuchen.',
      siet: 'Fehler: Der Server ist nicht erreichbar. Ihre Adresse wurde nicht gesendet. Bitte erneut versuchen.',
      cas: 'Fehler: Der Server hat nicht rechtzeitig geantwortet. Kommt in ein paar Minuten keine Bestätigungs-E-Mail, versuchen Sie es erneut.',
      server: 'Fehler: Bei uns ist etwas schiefgelaufen. Bitte in ein paar Minuten erneut versuchen.',
      vypnute: 'Der Versand des Ergebnisses ist vorübergehend abgeschaltet. Laden Sie das Ergebnis herunter oder kopieren Sie es.',
    }),
    hotovoNadpis: 'Bitte prüfen Sie Ihr Postfach',
    hotovoText: 'Den Bestätigungslink haben wir an {adresa} gesendet. Das Ergebnis kommt nach Ihrem Klick.',
    hotovoDrobne: 'Nach ein paar Minuten nichts da? Sehen Sie im Spam-Ordner nach. Eine nicht bestätigte Anfrage löschen wir nach 7 Tagen aus unserer Datenbank.',
    zmenit: 'Adresse ändern',
  }),
  cs: Object.freeze({
    nadpis: 'Poslat si výsledek e-mailem',
    uvodOprava: 'Výsledek neukládáme, po zavření stránky zmizí. Pošleme vám ho e-mailem i s postupem opravy.',
    uvodNalezy: 'Výsledek neukládáme, po zavření stránky zmizí. Pošleme vám ho e-mailem se seznamem nálezů.',
    uvodBezNalezov: 'Výsledek neukládáme, po zavření stránky zmizí. Pošleme vám ho e-mailem.',
    oddelenie: 'Kontrola e-mail nepotřebuje, poslání je dobrovolné.',
    pole: 'Váš e-mail',
    suhlas: 'Pošlete mi tento výsledek jedním e-mailem. Nejdřív mi přijde odkaz na potvrzení. Nic jiného.',
    tlacidlo: 'Poslat si výsledek',
    odosiela: 'Odesílá se…',
    spravcaSubor: 'E-mail posílá ARLing s. r. o. (Bratislava) s vaším souhlasem (čl. 6 odst. 1 písm. a) GDPR). Uložíme jen adresu a shrnutí výsledku (kódy a počty), nikdy obsah souboru.',
    spravcaObchod: 'E-mail posílá ARLing s. r. o. (Bratislava) s vaším souhlasem (čl. 6 odst. 1 písm. a) GDPR). Uložíme jen adresu a shrnutí výsledku (kódy, počty a adresu obchodu), nikdy obsah stránek obchodu.',
    zasadyPred: 'Podrobnosti v ',
    zasady: 'zásadách ochrany soukromí',
    zasadyPo: '.',
    chyby: Object.freeze({
      zla: 'Chyba: tohle nevypadá jako e-mailová adresa. Zkontrolujte překlep.',
      tvar: 'Chyba: tuto adresu nemůžeme použít. Před @ mohou být jen písmena bez diakritiky, číslice a znaky . _ % + -',
      limit: 'Chyba: příliš mnoho žádostí z této sítě nebo na tuto adresu. Zkuste to za hodinu; pokud jste na tuto adresu dnes už žádali dvakrát, až zítra.',
      strop: 'Dnes jsme už poslali nejvíc e-mailů, kolik si dovolíme. Zkuste to zítra; výsledek si zatím stáhněte nebo zkopírujte.',
      mail: 'Chyba: e-mail se nepodařilo odeslat. Zkuste to za pár minut.',
      siet: 'Chyba: server není dostupný. Adresa se neodeslala. Zkuste to znovu.',
      cas: 'Chyba: server neodpověděl včas. Pokud do pár minut nepřijde e-mail k potvrzení, zkuste to znovu.',
      server: 'Chyba: něco se pokazilo u nás. Zkuste to za pár minut.',
      vypnute: 'Posílání výsledku je dočasně vypnuté. Výsledek si stáhněte nebo zkopírujte.',
    }),
    hotovoNadpis: 'Zkontrolujte schránku',
    hotovoText: 'Odkaz k potvrzení jsme poslali na {adresa}. Výsledek přijde po kliknutí.',
    hotovoDrobne: 'Nic nepřišlo do pár minut? Podívejte se do složky se spamem. Nepotvrzenou žádost smažeme z naší databáze po 7 dnech.',
    zmenit: 'Změnit adresu',
  }),
});

/** Je výsledok bez nálezov (O3a, brána O8)? Vtedy úvodná veta bloku nesľubuje „postup opravy“ ani „zoznam nálezov“.
 *  agent-ready: žiadne zlyhané pravidlo a každý stav EÚ found, not_applicable alebo link_found; efaktura: 0 chýb a
 *  0 varovaní, alebo typ CII (pravidlá bežia len nad UBL 2.1, postup opravy v e-maile nie je); sepa: stav pass.
 *  z je zhrnutie po funkcii zhrnutie(); bez neho (null) false, teda pôvodná veta. */
const EU_BEZ_NALEZU = ['found', 'not_applicable', 'link_found'];
export function bezNalezov(nastroj, z) {
  if (!z || typeof z !== 'object') return false;
  if (nastroj === 'agent-ready') return Array.isArray(z.pravidla) && z.pravidla.length === 0 && Array.isArray(z.eu) && z.eu.every((e) => EU_BEZ_NALEZU.includes(e.stav));
  if (nastroj === 'efaktura') return z.typ === 'CII' || (z.chyby === 0 && z.varovania === 0);
  if (nastroj === 'sepa') return z.stav === 'pass';
  return false;
}
/** Úvodná veta podľa nástroja a výsledku: bez nálezov krátka veta (O8); SEPA e-mail nesie zoznam nálezov, postup opravy
 *  ukáže až Doctor (SPEC 2.8); kontrola e-shopu a e-faktúra s nálezmi aj s postupom opravy. */
export const uvodPre = (t, nastroj, z = null) => (bezNalezov(nastroj, z) ? t.uvodBezNalezov : nastroj === 'sepa' ? t.uvodNalezy : t.uvodOprava);
/** Riadok správcu podľa nástroja: pri kontrole e-shopu sa ukladá aj adresa obchodu a súbor nie je. */
export const spravcaPre = (t, nastroj) => (nastroj === 'agent-ready' ? t.spravcaObchod : t.spravcaSubor);

// ── Texty stránky potvrdenia (archív: bloky vysledok-v1/<jazyk>/potvrdit-<kľúč>) ──
export const TEXTY_POTVRDENIE = Object.freeze({
  sk: Object.freeze({
    titul: 'Poslať výsledok kontroly | ARLing',
    kicker: 'Výsledok kontroly e-mailom',
    nadpis: 'Poslať výsledok kontroly',
    nadpisHotovo: 'Výsledok je na ceste',
    text: 'Stlačením tlačidla potvrdíte, že výsledok chcete na adresu, na ktorú prišiel tento odkaz. Pošleme ho jedným e-mailom; ďalšie e-maily vám neposielame.',
    tlacidlo: 'Poslať výsledok',
    odosiela: 'Posiela sa…',
    odoslane: 'Hotovo. Výsledok sme poslali, o chvíľu ho nájdete v schránke. Vašu adresu sme vymazali z našej databázy.',
    strop: 'Dnes sme už poslali najviac e-mailov, koľko si dovolíme. Skúste to zajtra; odkaz platí 7 dní od žiadosti.',
    uz_odoslane: 'Tento výsledok sme už poslali. Pozrite schránku aj priečinok so spamom.',
    odosielaSa: 'Výsledok sa práve posiela. O minútu pozrite schránku.',
    neplatny: 'Odkaz neplatí alebo vypršal (platí 7 dní). Ak ste o e-mail požiadali viackrát, platí len posledný odkaz. Spustite kontrolu znova a požiadajte o nový e-mail.',
    bez_kluca: 'Otvorte odkaz z e-mailu ešte raz. Ak ste o e-mail požiadali viackrát, platí len posledný odkaz (7 dní od žiadosti).',
    mail: 'E-mail sa nepodarilo odoslať. Skúste to o pár minút znova.',
    siet: 'Server sa nedá zasiahnuť. Skúste znova.',
    limit: 'Príliš veľa pokusov z tejto siete. Skúste to o hodinu.',
    server: 'Niečo sa pokazilo u nás. Skúste to o pár minút znova.',
    spat: Object.freeze({ 'agent-ready': 'Späť na kontrolu e-shopu', efaktura: 'Späť na kontrolu e-faktúry', sepa: 'Späť na SEPA pain.001 Doctor' }),
    nastroje: Object.freeze({ 'agent-ready': 'Kontrola e-shopu', efaktura: 'Kontrola e-faktúry', sepa: 'SEPA pain.001 Doctor' }),
  }),
  en: Object.freeze({
    titul: 'Send the result of your check | ARLing',
    kicker: 'Result of a check by email',
    nadpis: 'Send the result of your check',
    nadpisHotovo: 'Your result is on its way',
    text: 'By pressing the button you confirm that you want the result sent to the address this link came to. We send it in one email; we send you no other emails.',
    tlacidlo: 'Send the result',
    odosiela: 'Sending…',
    odoslane: 'Done. We have sent the result; you will find it in your inbox shortly. We have deleted your address from our database.',
    strop: 'We have sent as many emails today as we allow ourselves. Try again tomorrow; the link works for 7 days from your request.',
    uz_odoslane: 'We have already sent this result. Check your inbox and your spam folder.',
    odosielaSa: 'The result is being sent right now. Check your inbox in a minute.',
    neplatny: 'This link is not valid or has expired (it works for 7 days). If you asked for the email more than once, only the latest link works. Run the check again and ask for a new email.',
    bez_kluca: 'Open the link from the email again. If you asked for the email more than once, only the latest link works (for 7 days from your request).',
    mail: 'The email could not be sent. Try again in a few minutes.',
    siet: 'Could not reach the server. Try again.',
    limit: 'Too many tries from this network. Try again in an hour.',
    server: 'Something went wrong on our side. Try again in a few minutes.',
    spat: Object.freeze({ 'agent-ready': 'Back to the store check', efaktura: 'Back to the e-invoice check', sepa: 'Back to SEPA pain.001 Doctor' }),
    nastroje: Object.freeze({ 'agent-ready': 'Store check', efaktura: 'E-invoice check', sepa: 'SEPA pain.001 Doctor' }),
  }),
  de: Object.freeze({
    titul: 'Ergebnis der Prüfung senden | ARLing',
    kicker: `Ergebnis der Prüfung per E-${WJ}Mail`,
    nadpis: 'Ergebnis der Prüfung senden',
    nadpisHotovo: 'Ihr Ergebnis ist unterwegs',
    text: 'Mit dem Klick bestätigen Sie, dass Sie das Ergebnis an die Adresse möchten, an die dieser Link kam. Wir senden es in einer E-Mail; weitere E-Mails schicken wir Ihnen nicht.',
    tlacidlo: 'Ergebnis senden',
    odosiela: 'Wird gesendet…',
    odoslane: 'Erledigt. Wir haben das Ergebnis gesendet, gleich finden Sie es in Ihrem Postfach. Ihre Adresse haben wir aus unserer Datenbank gelöscht.',
    strop: 'Wir haben heute schon so viele E-Mails gesendet, wie wir uns erlauben. Bitte morgen erneut versuchen; der Link gilt 7 Tage ab der Anfrage.',
    uz_odoslane: 'Dieses Ergebnis haben wir schon gesendet. Sehen Sie im Postfach und im Spam-Ordner nach.',
    odosielaSa: 'Das Ergebnis wird gerade gesendet. Sehen Sie in einer Minute in Ihr Postfach.',
    neplatny: 'Dieser Link ist ungültig oder abgelaufen (er gilt 7 Tage). Wenn Sie die E-Mail mehrmals angefordert haben, gilt nur der letzte Link. Starten Sie die Prüfung erneut und fordern Sie eine neue E-Mail an.',
    bez_kluca: 'Öffnen Sie den Link aus der E-Mail noch einmal. Wenn Sie die E-Mail mehrmals angefordert haben, gilt nur der letzte Link (7 Tage ab der Anfrage).',
    mail: 'Die E-Mail konnte nicht gesendet werden. Bitte in ein paar Minuten erneut versuchen.',
    siet: 'Der Server ist nicht erreichbar. Bitte erneut versuchen.',
    limit: 'Zu viele Versuche aus diesem Netz. Bitte in einer Stunde erneut versuchen.',
    server: 'Bei uns ist etwas schiefgelaufen. Bitte in ein paar Minuten erneut versuchen.',
    spat: Object.freeze({ 'agent-ready': 'Zurück zur Shop-Prüfung', efaktura: 'Zurück zur Prüfung der E-Rechnung', sepa: 'Zurück zum SEPA pain.001 Doctor' }),
    nastroje: Object.freeze({ 'agent-ready': 'Shop-Prüfung', efaktura: 'Prüfung der E-Rechnung', sepa: 'SEPA pain.001 Doctor' }),
  }),
  cs: Object.freeze({
    titul: 'Poslat výsledek kontroly | ARLing',
    kicker: 'Výsledek kontroly e-mailem',
    nadpis: 'Poslat výsledek kontroly',
    nadpisHotovo: 'Výsledek je na cestě',
    text: 'Stisknutím tlačítka potvrdíte, že výsledek chcete na adresu, na kterou přišel tento odkaz. Pošleme ho jedním e-mailem; další e-maily vám neposíláme.',
    tlacidlo: 'Poslat výsledek',
    odosiela: 'Odesílá se…',
    odoslane: 'Hotovo. Výsledek jsme poslali, za chvíli ho najdete ve schránce. Vaši adresu jsme vymazali z naší databáze.',
    strop: 'Dnes jsme už poslali nejvíc e-mailů, kolik si dovolíme. Zkuste to zítra; odkaz platí 7 dní od žádosti.',
    uz_odoslane: 'Tento výsledek jsme už poslali. Podívejte se do schránky i do složky se spamem.',
    odosielaSa: 'Výsledek se právě posílá. Za minutu se podívejte do schránky.',
    neplatny: 'Odkaz neplatí nebo vypršel (platí 7 dní). Pokud jste o e-mail požádali víckrát, platí jen poslední odkaz. Spusťte kontrolu znovu a požádejte o nový e-mail.',
    bez_kluca: 'Otevřete odkaz z e-mailu ještě jednou. Pokud jste o e-mail požádali víckrát, platí jen poslední odkaz (7 dní od žádosti).',
    mail: 'E-mail se nepodařilo odeslat. Zkuste to za pár minut znovu.',
    siet: 'Server není dostupný. Zkuste to znovu.',
    limit: 'Příliš mnoho pokusů z této sítě. Zkuste to za hodinu.',
    server: 'Něco se pokazilo u nás. Zkuste to za pár minut znovu.',
    spat: Object.freeze({ 'agent-ready': 'Zpět na kontrolu e-shopu', efaktura: 'Zpět na kontrolu e-faktury', sepa: 'Zpět na SEPA pain.001 Doctor' }),
    nastroje: Object.freeze({ 'agent-ready': 'Kontrola e-shopu', efaktura: 'Kontrola e-faktury', sepa: 'SEPA pain.001 Doctor' }),
  }),
});

/** Text správy stránky potvrdenia pre stav (odosiela je v textoch odosielaSa, lebo odosiela je text tlačidla). */
export const textStavu = (t, stav) => (stav === 'odosiela' ? t.odosielaSa : t[stav] || t.server);
