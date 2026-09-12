// A-014: jedna konkretna kniha pri hre, bez udajov hraca alebo noveho trackera.
export const KNIHY = {
  "badgers": {
    "nazov": "Killer Sudoku",
    "etsy": "4573944950"
  },
  "cranes": {
    "nazov": "Hashi",
    "etsy": "4573945662"
  },
  "hares": {
    "nazov": "Anti-knight Sudoku",
    "etsy": "4573945922"
  },
  "hedgehogs": {
    "nazov": "Star Battle",
    "etsy": "4573926879"
  },
  "herons": {
    "nazov": "Numberlink",
    "etsy": "4573945860"
  },
  "magpies": {
    "nazov": "Nonogram",
    "etsy": "4573945426"
  },
  "otters": {
    "nazov": "Slitherlink",
    "etsy": "4573945496"
  },
  "squirrels": {
    "nazov": "Kakuro",
    "etsy": "4573927131"
  },
  "swans": {
    "nazov": "Masyu",
    "etsy": "4573945736"
  },
  "voles": {
    "nazov": "Nurikabe",
    "etsy": "4573945796"
  }
};

export function pridajKnihu(dokument = document, okno = window) {
  const hra = okno.location.pathname.split('/')[2];
  const kniha = KNIHY[hra];
  const pravidla = dokument.querySelector('#rules');
  if (!kniha || !pravidla || dokument.getElementById('kniha-hry')) return;
  const panel = dokument.createElement('section');
  panel.id = 'kniha-hry';
  panel.className = 'deep';
  const obal = dokument.createElement('div');
  obal.className = 'wrap prose';
  const nadpis = dokument.createElement('h2');
  nadpis.textContent = kniha.nazov + ' on paper.';
  const popis = dokument.createElement('p');
  popis.textContent = '100 puzzles with solutions as a printable PDF in A4 and US Letter. See the book page for a free sample and current price.';
  const odkazy = dokument.createElement('p');
  for (const [kanal, href, text] of [
    ['arling', '/puzzle-books/#' + hra, 'View the ' + kniha.nazov + ' PDF book'],
    ['etsy', 'https://www.etsy.com/listing/' + kniha.etsy, 'Buy this PDF book on Etsy'],
  ]) {
    const a = dokument.createElement('a');
    a.href = href;
    a.textContent = text;
    a.dataset.knihaKanal = kanal;
    a.addEventListener('click', () => {
      try { okno.umami?.track('game_book_click', { hra, kanal }); } catch {}
    });
    if (odkazy.childNodes.length) odkazy.appendChild(dokument.createTextNode(' · '));
    odkazy.appendChild(a);
  }
  obal.append(nadpis, popis, odkazy);
  panel.appendChild(obal);
  pravidla.before(panel);
  for (const odsek of dokument.querySelectorAll('#about p')) {
    if (odsek.textContent.includes('Nothing else.')) odsek.textContent = odsek.textContent.replace('Nothing else.', 'We also count clicks to the PDF book, with the game name and destination (ARLing or Etsy). No puzzle entries or personal details are sent with that click.');
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => pridajKnihu(), { once: true });
  else pridajKnihu();
}
