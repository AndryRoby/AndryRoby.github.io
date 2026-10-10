// Adresa úrovne hry Stop (10. 10. 2026, brána yt-cesta pokus 1, nález M1): utm_* nechať len pri prvom načítaní,
// inak by každá zmena úrovne poslala do Umami novú návštevu s tým istým zdrojom a ten istý divák by sa zarátal viackrát.
export function adresaUrovne(href, n, prve = false) {
  if (prve) return href; // prvé načítanie adresu nemení, inak by tracker poslal druhú návštevu (brána pokus 2, N2)
  const url = new URL(href);
  url.searchParams.set('l', String(n));
  if (!prve) for (const k of [...url.searchParams.keys()]) if (k.startsWith('utm_')) url.searchParams.delete(k);
  return url.toString();
}
