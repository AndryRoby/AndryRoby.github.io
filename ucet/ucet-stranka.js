/* Hub zákazníka arling.sk/ucet/: prihlásenie e-mailom a kódom, nákupy,
 * doklady a predplatné, postup v hrách, odhlásenie a zabudnutie účtu.
 *
 * Jeden súbor obsluhuje slovenskú, anglickú aj nemeckú stránku (rovnaké
 * id prvkov v HTML), jazyk sa berie z <html lang>. Logiku volaní na worker
 * rieši zdieľaný klient /style/ucet.js (ops/spec-ucet.md, časť B); tento
 * súbor len napĺňa a číta DOM a formátuje texty.
 *
 * Podpora odkazu z e-mailu: ?email=...&kod=... na stránke automaticky
 * overí kód, bez toho, aby ho človek musel opisovať.
 *
 * Hry (Hedgehogs): tento skript číta localStorage rovnako ako
 * games/hedgehogs/game.js (kľúče hedgehogs:YYYY-MM-DD a hedgehogs:streak),
 * len na zobrazenie súčtu; samotnú hru ani jej ukladanie nemení.
 */
import * as ucet from '/style/ucet.js';

const LANG = document.documentElement.lang === 'de' ? 'de' : document.documentElement.lang === 'en' ? 'en' : 'sk';
const PRIVACY_URL = { sk: 'https://arling.sk/privacy/', en: 'https://arling.sk/privacy/en/', de: 'https://arling.sk/privacy/de/' }[LANG];
const KONTROLA_PREFIX = { sk: '', en: 'en/', de: 'de/' }[LANG];

const T = {
  sk: {
    zlyEmail: 'Zadajte platný e-mail.',
    odosielam: 'Posielam kód…',
    kodOdoslany: 'Kód sme poslali na e-mail, platí 15 minút.',
    limit: 'Priveľa pokusov, skúste to o hodinu.',
    mailNedostupny: 'Odosielanie kódov sa ešte zapína, napíšte na andrej@arling.sk.',
    chybaOdoslanie: 'Kód sa nepodarilo odoslať (sieť). Skúste to znova alebo napíšte na andrej@arling.sk.',
    bezKodu: 'Najprv si vyžiadajte kód.',
    overujem: 'Prihlasujem…',
    zlyKod: (n) => 'Nesprávny kód, ešte ' + n + (n === 1 ? ' pokus.' : n < 5 ? ' pokusy.' : ' pokusov.'),
    vycerpane: 'Kód vypršal alebo bol zadaný zle päťkrát, vyžiadajte si nový.',
    chybaPrihlasenie: 'Prihlásenie zlyhalo (sieť). Skúste to znova.',
    prihlasenyPred: 'Prihlásený ako ',
    prihlasenyPo: '.',
    nakupyPrihlasenie: 'Prihláste sa vyššie, aby ste videli svoje nákupy.',
    nakupyZiadne: 'K tomuto e-mailu zatiaľ nevidíme žiadny nákup. Ak ste platili, môže to chvíľu trvať; inak napíšte na andrej@arling.sk.',
    dokladyPrihlasenie: 'Prihláste sa vyššie, aby ste videli doklady a predplatné.',
    dokladyText: 'Faktúry, zmenu karty aj zrušenie predplatného (Bankové nástroje, Feed Doctor Monitor, Asistent) nájdete v zákazníckom portáli Stripe.',
    hryPrihlasenie: 'Prihláste sa vyššie, aby ste videli postup vo svojich hrách na všetkých zariadeniach.',
    hrySeria: 'dní v sérii',
    hryVyriesene: 'vyriešených záhrad',
    stlpecProdukt: 'Produkt', stlpecDatum: 'Dátum', stlpecSuma: 'Suma', stlpecAkcia: 'Čo urobiť',
    produktNeznamy: 'Nákup',
    produktGdpr: 'Balík GDPR dokumentov',
    produktOprava: 'Oprava pain.001 súboru',
    akciaGdpr: 'Otvoriť GDPR dokumenty',
    akciaGdprCesky: 'česká verzia',
    akciaKontrola: 'Zobraziť stav kontroly',
    akciaOprava: 'Opravený súbor sa nedá stiahnuť znova, u nás nie je uložený.',
    akciaIne: 'Doklad a podrobnosti nájdete v portáli Stripe nižšie.',
    zabudnutPotvrdenie: 'Naozaj chcete zmazať účet? Vymaže sa e-mail a postup vo hrách; nákupy ostávajú kvôli zákonu o účtovníctve. Toto sa nedá vrátiť späť.',
    zabudavam: 'Mažem účet…',
    zabudnuteHotovo: 'Účet bol vymazaný. Nákupy ostávajú v účtovníctve; ak ste chceli len odísť, stačilo sa odhlásiť.',
    zabudniChyba: 'Zmazanie zlyhalo (sieť). Skúste to znova alebo napíšte na andrej@arling.sk.',
    locale: 'sk-SK',
  },
  en: {
    zlyEmail: 'Enter a valid e-mail address.',
    odosielam: 'Sending code…',
    kodOdoslany: 'We sent a code to your e-mail, it is valid for 15 minutes.',
    limit: 'Too many attempts, try again in an hour.',
    mailNedostupny: 'Sending codes is still being switched on, please e-mail andrej@arling.sk.',
    chybaOdoslanie: 'The code could not be sent (network). Try again or e-mail andrej@arling.sk.',
    bezKodu: 'Request a code first.',
    overujem: 'Signing in…',
    zlyKod: (n) => 'Wrong code, ' + n + (n === 1 ? ' attempt left.' : ' attempts left.'),
    vycerpane: 'The code expired or was entered wrong five times, request a new one.',
    chybaPrihlasenie: 'Sign-in failed (network). Try again.',
    prihlasenyPred: 'Signed in as ',
    prihlasenyPo: '.',
    nakupyPrihlasenie: 'Sign in above to see your purchases.',
    nakupyZiadne: 'We do not see any purchase for this e-mail yet. If you just paid, it can take a moment; otherwise write to andrej@arling.sk.',
    dokladyPrihlasenie: 'Sign in above to see receipts and subscriptions.',
    dokladyText: 'Invoices, changing your card and cancelling a subscription (Bankové nástroje, Feed Doctor Monitor, Asistent) are all in the Stripe customer portal.',
    hryPrihlasenie: 'Sign in above to see your progress across every device.',
    hrySeria: 'days in a row',
    hryVyriesene: 'gardens solved',
    stlpecProdukt: 'Product', stlpecDatum: 'Date', stlpecSuma: 'Amount', stlpecAkcia: 'What to do',
    produktNeznamy: 'Purchase',
    produktGdpr: 'GDPR document bundle',
    produktOprava: 'pain.001 file fix',
    akciaGdpr: 'Open GDPR documents',
    akciaGdprCesky: 'Czech version',
    akciaKontrola: 'View check status',
    akciaOprava: 'The fixed file cannot be downloaded again, we do not keep it on our side.',
    akciaIne: 'Find the receipt and details in the Stripe portal below.',
    zabudnutPotvrdenie: 'Delete your account? This removes your e-mail and game progress; purchases remain because of accounting law. This cannot be undone.',
    zabudavam: 'Deleting your account…',
    zabudnuteHotovo: 'Your account was deleted. Purchases remain for accounting reasons; if you only wanted to leave, signing out would have been enough.',
    zabudniChyba: 'Deleting the account failed (network). Try again or e-mail andrej@arling.sk.',
    locale: 'en-US',
  },
  de: {
    zlyEmail: 'Geben Sie eine gültige E-Mail-Adresse ein.',
    odosielam: 'Code wird gesendet…',
    kodOdoslany: 'Wir haben einen Code an Ihre E-Mail-Adresse gesendet, er gilt 15 Minuten.',
    limit: 'Zu viele Versuche, versuchen Sie es in einer Stunde erneut.',
    mailNedostupny: 'Der Versand von Codes wird gerade erst eingerichtet, schreiben Sie bitte an andrej@arling.sk.',
    chybaOdoslanie: 'Der Code konnte nicht gesendet werden (Netzwerk). Versuchen Sie es erneut oder schreiben Sie an andrej@arling.sk.',
    bezKodu: 'Fordern Sie zuerst einen Code an.',
    overujem: 'Anmeldung läuft…',
    zlyKod: (n) => 'Falscher Code, noch ' + n + (n === 1 ? ' Versuch.' : ' Versuche.'),
    vycerpane: 'Der Code ist abgelaufen oder wurde fünfmal falsch eingegeben, fordern Sie einen neuen an.',
    chybaPrihlasenie: 'Die Anmeldung ist fehlgeschlagen (Netzwerk). Versuchen Sie es erneut.',
    prihlasenyPred: 'Angemeldet als ',
    prihlasenyPo: '.',
    nakupyPrihlasenie: 'Melden Sie sich oben an, um Ihre Käufe zu sehen.',
    nakupyZiadne: 'Zu dieser E-Mail-Adresse sehen wir noch keinen Kauf. Wenn Sie gerade bezahlt haben, kann es einen Moment dauern; sonst schreiben Sie an andrej@arling.sk.',
    dokladyPrihlasenie: 'Melden Sie sich oben an, um Belege und Abos zu sehen.',
    dokladyText: 'Rechnungen, Kartenwechsel und Kündigung eines Abos (Bankové nástroje, Feed Doctor Monitor, Asistent) finden Sie im Stripe-Kundenportal.',
    hryPrihlasenie: 'Melden Sie sich oben an, um Ihren Fortschritt auf jedem Gerät zu sehen.',
    hrySeria: 'Tage in Folge',
    hryVyriesene: 'gelöste Gärten',
    stlpecProdukt: 'Produkt', stlpecDatum: 'Datum', stlpecSuma: 'Betrag', stlpecAkcia: 'Was zu tun ist',
    produktNeznamy: 'Kauf',
    produktGdpr: 'GDPR-Dokumentenpaket',
    produktOprava: 'pain.001-Datei-Korrektur',
    akciaGdpr: 'GDPR-Dokumente öffnen',
    akciaGdprCesky: 'tschechische Version',
    akciaKontrola: 'Prüfstatus ansehen',
    akciaOprava: 'Die korrigierte Datei kann nicht erneut heruntergeladen werden, wir speichern sie nicht bei uns.',
    akciaIne: 'Beleg und Details finden Sie im Stripe-Portal unten.',
    zabudnutPotvrdenie: 'Konto wirklich löschen? Das entfernt Ihre E-Mail-Adresse und den Spielstand; Käufe bleiben wegen des Buchhaltungsgesetzes erhalten. Das lässt sich nicht rückgängig machen.',
    zabudavam: 'Konto wird gelöscht…',
    zabudnuteHotovo: 'Ihr Konto wurde gelöscht. Käufe bleiben aus buchhalterischen Gründen erhalten; wollten Sie sich nur abmelden, hätte das Abmelden gereicht.',
    zabudniChyba: 'Löschen fehlgeschlagen (Netzwerk). Versuchen Sie es erneut oder schreiben Sie an andrej@arling.sk.',
    locale: 'de-DE',
  },
}[LANG];

const $ = (id) => document.getElementById(id);
function track(name, data) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, data); } catch (e) { /* nič */ } }

const emailForm = $('email-formular');
const emailInput = $('email');
const posliKodBtn = $('posli-kod');
const kodForm = $('kod-formular');
const kodInput = $('kod');
const prihlasitBtn = $('prihlasit');
const hlaska = $('hlaska-prihlasenie');
const poslatZnovaBlok = $('poslat-znova-blok');
const poslatZnovaBtn = $('poslat-znova');
const stavPrihlaseny = $('stav-prihlaseny');
const prihlasovanieBlok = $('prihlasovanie');

const nakupyPrazdne = $('nakupy-prazdne');
const nakupyBlok = $('nakupy-tabulka-blok');
const nakupyTbody = $('nakupy-tbody');
const dokladyText = $('doklady-text');
const portalOdkaz = $('portal-odkaz');
const hryText = $('hry-text');
const hryObsah = $('hry-obsah');
const hryFakty = $('hry-fakty');
const spravaUctu = $('sprava-uctu');
const odhlasitBtn = $('odhlasit-btn');
const zabudniBtn = $('zabudni-btn');
const spravaHlaska = $('sprava-hlaska');

let emailAktualny = '';

/* ── Drobné pomocníky ─────────────────────────────────────────────────── */
function hlaskaText(el, text, druh) {
  el.textContent = text || '';
  el.className = 'hlaska' + (druh ? ' hlaska-' + druh : '');
}
function maskEmail(email) {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at <= 0) return s;
  return s.slice(0, 1) + '***' + s.slice(at);
}
/* Chybu z /style/ucet.js nesie e.data (JSON telo odpovede workera, viď
 * ops/spec-ucet.md, časť A); pri chybe siete e.data neexistuje a spadne
 * sa na poctivú všeobecnú vetu. */
function chybaPosliKod(e) {
  const kod = e && e.data && e.data.error;
  if (kod === 'bad_email') return T.zlyEmail;
  if (kod === 'rate_limited') return T.limit;
  if (kod === 'mail_unavailable') return T.mailNedostupny;
  return T.chybaOdoslanie;
}
function chybaOver(e) {
  const d = e && e.data;
  const kod = d && d.error;
  if (kod === 'no_code') return T.bezKodu;
  if (kod === 'rate_limited') return T.limit;
  if (kod === 'bad_code') return d.remaining ? T.zlyKod(d.remaining) : T.vycerpane;
  return T.chybaPrihlasenie;
}

/* ── Formátovanie nákupov ─────────────────────────────────────────────── */
function datumNaText(d) {
  let dt = null;
  if (typeof d === 'number') dt = new Date(d < 2e10 ? d * 1000 : d); // unix sekundy vs. milisekundy
  else if (typeof d === 'string') { const t = Date.parse(d); if (!Number.isNaN(t)) dt = new Date(t); }
  if (!dt || Number.isNaN(dt.getTime())) return typeof d === 'string' ? d : '';
  try { return dt.toLocaleDateString(T.locale, { day: 'numeric', month: 'numeric', year: 'numeric' }); }
  catch (e) { return dt.toISOString().slice(0, 10); }
}
function sumaNaText(suma, mena) {
  if (typeof suma !== 'number') return '';
  try { return new Intl.NumberFormat(T.locale, { style: 'currency', currency: (mena || 'EUR').toUpperCase() }).format(suma / 100); }
  catch (e) { return (suma / 100).toFixed(2) + ' ' + (mena || 'EUR').toUpperCase(); }
}
/* Názov produktu vo worker zázname je buď krátky kód z metadát platobného
 * odkazu (napr. "gdpr-39"), alebo trojjazyčný názov produktu v Stripe
 * oddelený lomkou (viď ops/stripe/*.mjs). Vyberie sa čitateľný tvar. */
function nazovProduktu(produkt) {
  if (!produkt) return T.produktNeznamy;
  const ZNAME = { 'gdpr-39': T.produktGdpr, 'gdpr-39-test': T.produktGdpr, 'oprava-29': T.produktOprava };
  if (ZNAME[produkt]) return ZNAME[produkt];
  const casti = produkt.split(' / ');
  if (casti.length === 3) return casti[LANG === 'de' ? 1 : LANG === 'en' ? 2 : 0];
  return produkt;
}
function druhProduktu(produkt) {
  const p = String(produkt || '').toLowerCase();
  if (p.indexOf('gdpr') !== -1) return 'gdpr';
  if (p.indexOf('oprava') !== -1 || p.indexOf('korrigier') !== -1 || p.indexOf('file fix') !== -1) return 'oprava';
  if (p.indexOf('kontrola') !== -1 || p.indexOf('prüfung') !== -1 || p.indexOf('file check') !== -1) return 'kontrola';
  return 'ine';
}
function akciaBunka(nakup) {
  const td = document.createElement('td');
  td.setAttribute('data-th', T.stlpecAkcia);
  const obal = document.createElement('div');
  obal.className = 'nakupy-akcia';
  const druh = druhProduktu(nakup.produkt);
  if (druh === 'gdpr') {
    const a = document.createElement('a');
    a.className = 'btn btn-line'; a.href = '/gdpr-dokumenty/?ucet=1'; a.textContent = T.akciaGdpr;
    obal.appendChild(a);
    const p = document.createElement('p');
    p.className = 'vedlajsi';
    const cs = document.createElement('a');
    cs.href = '/gdpr-dokumenty/cs/?ucet=1'; cs.textContent = T.akciaGdprCesky;
    p.appendChild(cs);
    obal.appendChild(p);
  } else if (druh === 'kontrola' && nakup.session_id) {
    const a = document.createElement('a');
    a.className = 'btn btn-line';
    a.href = '/kontrola-suboru/' + KONTROLA_PREFIX + 'nahrat/?session_id=' + encodeURIComponent(nakup.session_id);
    a.textContent = T.akciaKontrola;
    obal.appendChild(a);
  } else if (druh === 'oprava') {
    const p = document.createElement('p');
    p.className = 'nakupy-poznamka'; p.textContent = T.akciaOprava;
    obal.appendChild(p);
  } else {
    const p = document.createElement('p');
    p.className = 'nakupy-poznamka'; p.textContent = T.akciaIne;
    obal.appendChild(p);
  }
  td.appendChild(obal);
  return td;
}
function bunka(text) { const td = document.createElement('td'); td.textContent = text; return td; }
function naplnNakupy(nakupy) {
  // Testovacie platby (livemode false) sú Andrejove vlastné skúšky, nie
  // skutočný nákup zákazníka: v hube sa nezobrazujú.
  const zive = nakupy.filter((n) => n && n.livemode !== false);
  nakupyTbody.textContent = '';
  if (!zive.length) {
    nakupyPrazdne.hidden = false;
    nakupyPrazdne.textContent = T.nakupyZiadne;
    nakupyBlok.hidden = true;
    return;
  }
  nakupyPrazdne.hidden = true;
  nakupyBlok.hidden = false;
  zive.slice().sort((a, b) => String(b.datum).localeCompare(String(a.datum))).forEach((n) => {
    const tr = document.createElement('tr');
    const tdP = bunka(nazovProduktu(n.produkt)); tdP.setAttribute('data-th', T.stlpecProdukt); tr.appendChild(tdP);
    const tdD = bunka(datumNaText(n.datum)); tdD.setAttribute('data-th', T.stlpecDatum); tr.appendChild(tdD);
    const tdS = bunka(sumaNaText(n.suma, n.mena)); tdS.setAttribute('data-th', T.stlpecSuma); tr.appendChild(tdS);
    tr.appendChild(akciaBunka(n));
    nakupyTbody.appendChild(tr);
  });
}

/* ── Doklady a predplatné ─────────────────────────────────────────────── */
function naplnDoklady(portalUrl) {
  dokladyText.hidden = false;
  dokladyText.textContent = T.dokladyText;
  if (portalUrl) { portalOdkaz.hidden = false; portalOdkaz.href = portalUrl; }
  else portalOdkaz.hidden = true;
}

/* ── Hry: rovnaké kľúče localStorage ako games/hedgehogs/game.js ────────── */
function dnesLokalne() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function vceraZ(iso) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function hedgehogsFakty() {
  let vyriesene = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf('hedgehogs:') !== 0) continue;
      const zvysok = k.slice('hedgehogs:'.length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(zvysok)) continue; // preskočí :streak, :settings, :p:<sada>:<k>
      let s = null;
      try { s = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
      if (s && s.done) vyriesene++;
    }
  } catch (e) { /* localStorage nedostupné (súkromné okno) */ }
  let seria = 0;
  try {
    const s = JSON.parse(localStorage.getItem('hedgehogs:streak'));
    if (s && s.pocet) {
      const dnes = dnesLokalne();
      if (s.posledny === dnes || s.posledny === vceraZ(dnes)) seria = s.pocet;
    }
  } catch (e) { /* nič */ }
  return { vyriesene, seria };
}
function polozkaFaktu(cislo, popis) {
  const div = document.createElement('div');
  const b = document.createElement('b'); b.textContent = String(cislo); div.appendChild(b);
  const span = document.createElement('span'); span.textContent = popis; div.appendChild(span);
  return div;
}
function naplnHry() {
  const { vyriesene, seria } = hedgehogsFakty();
  hryText.hidden = true;
  hryObsah.hidden = false;
  hryFakty.textContent = '';
  hryFakty.appendChild(polozkaFaktu(seria, T.hrySeria));
  hryFakty.appendChild(polozkaFaktu(vyriesene, T.hryVyriesene));
}

/* ── Prepínanie medzi prihláseným a neprihláseným zobrazením ─────────────── */
function zobrazPrihlaseny(data) {
  prihlasovanieBlok.hidden = true;
  stavPrihlaseny.hidden = false;
  stavPrihlaseny.textContent = '';
  stavPrihlaseny.appendChild(document.createTextNode(T.prihlasenyPred));
  const b = document.createElement('b'); b.textContent = maskEmail(data.email);
  stavPrihlaseny.appendChild(b);
  stavPrihlaseny.appendChild(document.createTextNode(T.prihlasenyPo));
  naplnNakupy(Array.isArray(data.nakupy) ? data.nakupy : []);
  naplnDoklady(data.portal_url);
  naplnHry();
  spravaUctu.hidden = false;
}
function zobrazNeprihlaseny() {
  prihlasovanieBlok.hidden = false;
  stavPrihlaseny.hidden = true;
  spravaUctu.hidden = true;
  nakupyPrazdne.hidden = false; nakupyPrazdne.textContent = T.nakupyPrihlasenie;
  nakupyBlok.hidden = true;
  dokladyText.hidden = false; dokladyText.textContent = T.dokladyPrihlasenie;
  portalOdkaz.hidden = true;
  hryText.hidden = false; hryText.textContent = T.hryPrihlasenie;
  hryObsah.hidden = true;
}
async function nacitajAZobraz() {
  try {
    const data = await ucet.ja();
    zobrazPrihlaseny(data);
  } catch (e) {
    // token je neplatný alebo vypršal, alebo je výpadok siete: v oboch
    // prípadoch sa stránka správa, akoby nebol nikto prihlásený, bez
    // strašidelnej chybovej hlášky pri bežnom prvom načítaní.
    zobrazNeprihlaseny();
  }
}

/* ── Prihlásenie: pošli kód, over kód ─────────────────────────────────── */
async function overKod(email, kod) {
  hlaskaText(hlaska, T.overujem);
  prihlasitBtn.disabled = true;
  try {
    await ucet.over(email, kod);
    track('ucet_prihlasenie', {});
    hlaskaText(hlaska, '');
    await nacitajAZobraz();
  } catch (e) {
    hlaskaText(hlaska, chybaOver(e), 'chyba');
  } finally {
    prihlasitBtn.disabled = false;
  }
}

emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const mail = emailInput.value.trim();
  if (!mail || mail.indexOf('@') < 0) { hlaskaText(hlaska, T.zlyEmail, 'chyba'); return; }
  posliKodBtn.disabled = true;
  hlaskaText(hlaska, T.odosielam);
  try {
    await ucet.posliKod(mail, LANG);
    emailAktualny = mail;
    hlaskaText(hlaska, T.kodOdoslany, 'ok');
    kodForm.hidden = false;
    poslatZnovaBlok.hidden = false;
    kodInput.focus();
    track('ucet_kod_odoslany', {});
  } catch (e) {
    hlaskaText(hlaska, chybaPosliKod(e), 'chyba');
  } finally {
    posliKodBtn.disabled = false;
  }
});

kodForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const mail = emailAktualny || emailInput.value.trim();
  const kod = kodInput.value.trim();
  if (!kod) { hlaskaText(hlaska, T.bezKodu, 'chyba'); return; }
  await overKod(mail, kod);
});

poslatZnovaBtn.addEventListener('click', async () => {
  const mail = emailAktualny || emailInput.value.trim();
  if (!mail) return;
  poslatZnovaBtn.disabled = true;
  hlaskaText(hlaska, T.odosielam);
  try {
    await ucet.posliKod(mail, LANG);
    hlaskaText(hlaska, T.kodOdoslany, 'ok');
    track('ucet_kod_znova', {});
  } catch (e) {
    hlaskaText(hlaska, chybaPosliKod(e), 'chyba');
  } finally {
    poslatZnovaBtn.disabled = false;
  }
});

/* ── Odhlásiť sa, Zabudnite ma ────────────────────────────────────────── */
function vycistiFormulare() {
  emailForm.reset();
  kodForm.reset();
  kodForm.hidden = true;
  poslatZnovaBlok.hidden = true;
}
odhlasitBtn.addEventListener('click', async () => {
  odhlasitBtn.disabled = true;
  await ucet.odhlas();
  track('ucet_odhlasenie', {});
  zobrazNeprihlaseny();
  vycistiFormulare();
  hlaskaText(hlaska, '');
  odhlasitBtn.disabled = false;
});
zabudniBtn.addEventListener('click', async () => {
  if (!window.confirm(T.zabudnutPotvrdenie)) return;
  zabudniBtn.disabled = true;
  hlaskaText(spravaHlaska, T.zabudavam);
  try {
    await ucet.zabudni();
    track('ucet_zabudnute', {});
    zobrazNeprihlaseny();
    vycistiFormulare();
    hlaskaText(spravaHlaska, '');
    hlaskaText(hlaska, T.zabudnuteHotovo, 'ok');
  } catch (e) {
    hlaskaText(spravaHlaska, T.zabudniChyba, 'chyba');
  } finally {
    zabudniBtn.disabled = false;
  }
});

/* ── Štart: už prihlásený na tomto zariadení, alebo odkaz z e-mailu ─────── */
(async function start() {
  let email = '', kod = '';
  try {
    const p = new URL(location.href).searchParams;
    email = (p.get('email') || '').trim();
    kod = (p.get('kod') || '').trim();
  } catch (e) { /* nič */ }
  if (email && kod) history.replaceState(null, '', location.pathname + location.hash);

  if (ucet.prihlaseny()) { await nacitajAZobraz(); return; }

  if (email && kod) {
    emailInput.value = email;
    emailAktualny = email;
    kodForm.hidden = false;
    poslatZnovaBlok.hidden = false;
    kodInput.value = kod;
    await overKod(email, kod);
  }
  // inak: statický HTML už ukazuje správny neprihlásený stav
})();
