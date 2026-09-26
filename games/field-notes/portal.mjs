/* Field Notes: rozhranie pre neskoršie odmenené video (M0, 26. 9. 2026).
 *
 * Pravidlá: ops/hry/portfolio/TOVAREN-HIER.md, časti 7 a 8.
 *   - Na webe arling.sk nie je žiadna reklama. Tento adaptér je preto vypnutý
 *     a hra ho nikdy nezavolá tak, aby niečo ukázala.
 *   - Neskôr (Android, portál po Full Launch) sa sem dosadí skutočný adaptér:
 *     video len z listu nápovedy, len na ťuk hráča, dve rovnako veľké tlačidlá
 *     „Watch a short video for a hint“ a „Not now“, odmena pevná a pomenovaná
 *     vopred, žiadna medzireklama, žiadne odpočty, žiadne životy.
 *   - Nápoveda na webe je zadarmo a bez limitu.
 * Test ops/hry/field-notes/tests.mjs drží, že tu je reklamaPovolena false
 * a že v kóde hry nie je volanie medzireklamy.
 */
export const portal = {
  meno: 'web',
  reklamaPovolena: false,
  /* Vráti true len vtedy, keď hráč video dopozeral a odmena je potvrdená. Na webe nikdy. */
  async odmenaZaVideo(/* dovod */) {
    return false;
  },
  hraZacala() {},
  hraStoji() {},
};

/* Text listu nápovedy pre budúci adaptér (na webe sa nepoužije). */
export const LIST_NAPOVEDY = {
  otazka: 'Stuck on a word?',
  video: 'Watch a short video for a hint',
  nie: 'Not now',
};
