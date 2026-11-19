// Kaviareň Okenica (ukážka). Beží v hlave pred prvým vykreslením: oznámi štýlom, že skript funguje,
// aby úvod počkal na fotky a písmo a prišiel naraz. Poistka: ak by app.js nedobehol, úvod sa ukáže sám.
document.documentElement.classList.add('js');
setTimeout(function () { document.documentElement.classList.add('stol'); }, 1800);
