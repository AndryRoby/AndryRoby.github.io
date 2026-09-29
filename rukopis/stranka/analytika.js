// Malý lokálny klient protokolu Umami. CSP nepovoľuje cudzie skripty.
export function zaznamenaj(nazov, data, env = globalThis) {
  const { location, navigator } = env;
  if (!location || location.hostname !== 'arling.sk' || new URLSearchParams(location.search).get('test') === '1' || navigator?.doNotTrack === '1') return;
  if (!['sk','cs','en','de'].includes(data.jazyk)) return;
  const udaje = { jazyk: data.jazyk };
  if (nazov === 'rukopis_meranie') {
    if (!['30-79','80-199','200-499','500-1999','2000+'].includes(data.slov_vedro) ||
        !['zivy','zmiesany','prilis_uhladeny'].includes(data.pasmo)) return;
    udaje.slov_vedro = data.slov_vedro;
    udaje.pasmo = data.pasmo;
  } else if (nazov !== 'rukopis_ukazka_klik') return;
  const payload = {
    website: 'be534d51-4d01-4860-b267-9596d91606de',
    hostname: 'arling.sk', language: data.jazyk, title: 'Rukopis',
    url: /^\/rukopis\/(?:en\/|cs\/|de\/)?$/.test(location.pathname) ? location.pathname : '/rukopis/',
    referrer: '', name: nazov, data: udaje
  };
  try {
    Promise.resolve(env.fetch('https://api.arling.workers.dev/api/send', {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'event', payload })
    })).catch(() => {});
  } catch { /* Analytika nesmie prerušiť meranie. */ }
}
