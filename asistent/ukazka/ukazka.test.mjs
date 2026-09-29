import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const jazykoveCesty = { sk: '', en: 'en/', de: 'de/' };
const koren = new URL('./', import.meta.url);
const citaj = (p) => readFileSync(new URL(p, koren), 'utf8');
const stranky = Object.fromEntries(Object.entries(jazykoveCesty).map(([l, p]) => [l, citaj(p + 'index.html')]));
const adresa = (l) => 'https://arling.sk/asistent/ukazka/' + jazykoveCesty[l];
const polozky = (xml) => [...xml.matchAll(/<SHOPITEM>([\s\S]*?)<\/SHOPITEM>/g)].map((m) => m[1]);
const pole = (xml, tag) => (xml.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>')) || [])[1] || '';
const csp = (html) => html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
const sk = polozky(citaj('feed.xml'));

for (const [lang, cesta] of Object.entries(jazykoveCesty)) {
  test(lang + ': canonical, úplný hreflang, prepínač, spoločné súbory a CSP', () => {
    const html = stranky[lang];
    assert.ok(html.includes('<html lang="' + lang + '">'));
    assert.ok(html.includes('<link rel="canonical" href="' + adresa(lang) + '">'));
    for (const alt of ['sk', 'en', 'de', 'x-default']) {
      const href = adresa(alt === 'x-default' ? 'sk' : alt);
      assert.ok(html.includes('<link rel="alternate" hreflang="' + alt + '" href="' + href + '">'), alt);
    }
    const nav = html.match(/<nav class="jazyky"[\s\S]*?<\/nav>/)[0];
    for (const l of ['sk', 'en', 'de']) assert.ok(nav.includes('hreflang="' + l + '"'));
    assert.equal((nav.match(/aria-current="page"/g) || []).length, 1);
    assert.match(nav, new RegExp('lang="' + lang + '"[^>]+aria-current="page"'));
    assert.equal(csp(html), csp(stranky.sk));
    assert.doesNotMatch(csp(html), /unsafe-inline|unsafe-eval/);
    const skripty = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    for (const [, attrs, body] of skripty) {
      assert.match(attrs, /\bsrc="[^"]+"/);
      assert.equal(body.trim(), '');
    }
    for (const attr of ['src', 'href']) {
      const refs = [...html.matchAll(new RegExp(attr + '="([^"#]+)"', 'g'))].map((m) => m[1]);
      for (const ref of refs.filter((s) => /(?:ukazka\.(?:js|css)|logo\.svg)(?:\?|$)/.test(s))) {
        const url = new URL(ref, new URL(cesta + 'index.html', koren));
        url.search = '';
        assert.ok(existsSync(fileURLToPath(url)), ref);
      }
    }
    assert.ok(html.includes('data-website-id="09cc54da-8172-43b3-8aa2-84e3ab5a17f1"'));
    assert.ok(html.includes('data-umami-event-lang="' + lang + '"'));
    assert.doesNotMatch(html, /[\u2013\u2014]/);
  });

  test(lang + ': 64 výrobkov, rovnaké ID, ceny, dostupnosť, značky a obrázky', () => {
    const xml = citaj(cesta + 'feed.xml');
    const feed = polozky(xml);
    assert.equal(feed.length, 64);
    assert.equal((xml.match(/<SHOPITEM>/g) || []).length, 64);
    assert.equal(new Set(feed.map((p) => pole(p, 'ITEM_ID'))).size, 64);
    const povodne = new Map(sk.map((p) => [pole(p, 'ITEM_ID'), p]));
    for (const p of feed) {
      const id = pole(p, 'ITEM_ID');
      const original = povodne.get(id);
      assert.ok(original, id);
      for (const tag of ['PRICE_VAT', 'DELIVERY_DATE', 'MANUFACTURER', 'EAN', 'ITEMGROUP_ID', 'IMGURL']) {
        assert.equal(pole(p, tag), pole(original, tag), id + ': ' + tag);
      }
      assert.equal(pole(p, 'URL'), adresa(lang) + '#p-' + id);
      assert.ok(existsSync(new URL('img/' + id + '.svg', koren)));
      assert.ok(pole(p, 'DESCRIPTION'));
      if (lang !== 'sk') {
        assert.equal(pole(p, 'PRODUCT'), pole(p, 'PRODUCTNAME'));
        assert.doesNotMatch(pole(p, 'PRODUCTNAME'), /[ľščťžýáíéôň]/i, id);
        assert.equal((p.match(/<PARAM>/g) || []).length, (original.match(/<PARAM>/g) || []).length, id);
      }
    }
    assert.equal(new Set(feed.map((p) => pole(p, 'CATEGORYTEXT').split(' | ')[0])).size, 6);
    assert.doesNotMatch(xml, /[\u2013\u2014]/);
  });

  test(lang + ': widget používa jazyk stránky, správneho tenanta, feed a otázky', () => {
    const inserted = [];
    const handlers = {};
    const node = () => ({ setAttribute(k, v) { this[k] = v; }, addEventListener() {} });
    const location = new URL(adresa(lang) + '?ui=sk');
    let feedUrl;
    const document = {
      title: lang,
      documentElement: { lang },
      createElement: node,
      querySelector: (selector) => selector.includes('canonical') ? { href: adresa(lang) } : { content: lang },
      getElementById: (id) => ({ addEventListener(event, cb) { handlers[id + ':' + event] = cb; } }),
      head: { appendChild: (el) => inserted.push(el) },
      body: { appendChild: (el) => inserted.push(el) }
    };
    vm.runInNewContext(citaj('ukazka.js'), {
      document, location, URL, URLSearchParams,
      window: { addEventListener() {} },
      fetch(url) { feedUrl = url; return new Promise(() => {}); }
    });
    const widget = inserted.find((el) => el['data-tenant']);
    const tenants = { sk: 'ce535d37-f297-4b43-89dd-30aa7b6301dd', en: '75354c54-c99a-4853-8c23-de9aa6ff13c5', de: '080e07bb-37b9-40e3-8c3b-14e4d24b79c8' };
    assert.equal(widget['data-tenant'], tenants[lang]);
    assert.equal(widget['data-lang'], lang);
    assert.equal(new URL(widget.src, location).href, 'https://arling.sk/asistent/widget.js');
    assert.equal(feedUrl, adresa(lang) + 'feed.xml');
    const questions = JSON.parse(widget['data-questions']);
    assert.equal(questions.length, 4);
    const expected = { sk: /babku/, en: /grandma/, de: /Oma/ };
    assert.match(questions[1], expected[lang]);
    const cats = JSON.parse(widget['data-kategorie']);
    const feedCategories = new Set(polozky(citaj(cesta + 'feed.xml')).map((p) => pole(p, 'CATEGORYTEXT').split(' | ')[0]));
    for (const k of cats) assert.ok(feedCategories.has(k.nazov), k.nazov);
    handlers['pozriet-kavovary:click']({ preventDefault() {} });
    assert.match(location.hash, /^#k-/);
    const pageData = JSON.parse(inserted.find((el) => el.type === 'application/ld+json').textContent);
    assert.equal(pageData.inLanguage, lang);
  });
}

test('EN a DE landing: tlačidlá aj popis snímok vedú do príslušnej ukážky', () => {
  for (const lang of ['en', 'de']) {
    const html = citaj('../' + lang + '/index.html');
    const links = [...html.matchAll(/<a\b([^>]+)>/g)].map((m) => m[1]).filter((a) => /data-i18n="cta.demo"/.test(a));
    assert.equal(links.length, 2);
    for (const a of links) assert.ok(a.includes('href="/asistent/ukazka/' + lang + '/"'));
    const caption = html.match(/<figcaption[^>]*data-i18n-html="shots.caption"[^>]*>([\s\S]*?)<\/figcaption>/)[1];
    assert.ok(caption.includes('href="/asistent/ukazka/' + lang + '/"'));
  }
});
