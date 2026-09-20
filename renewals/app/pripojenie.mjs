// Same-origin installations retain HttpOnly cookies. The arling.sk installation
// uses a short-lived opaque session in this tab only, without third-party cookies.
export function pripojenie(product, fallback) {
  const configured = document.querySelector('meta[name="arling-api"]')?.content;
  const endpoint = new URL(configured || fallback);
  if (configured && endpoint.origin !== 'https://homelab.tailbf8f27.ts.net' &&
      !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname)))
    throw new Error('Unexpected API address.');
  const cross = endpoint.origin !== location.origin, key = `arling-${product}-session`;
  let session = null;
  if (cross) try { session = JSON.parse(sessionStorage.getItem(key)); } catch {}
  if (!/^[A-Za-z0-9_-]{43}$/.test(session?.accessToken || '') || typeof session?.csrfToken !== 'string') session = null;
  function clear() { session = null; try { sessionStorage.removeItem(key); } catch {} }
  function remember(value) {
    if (cross && /^[A-Za-z0-9_-]{43}$/.test(value?.accessToken || '') && typeof value.csrfToken === 'string') {
      session = { accessToken: value.accessToken, csrfToken: value.csrfToken };
      try { sessionStorage.setItem(key, JSON.stringify(session)); } catch {} // In-memory fallback.
    }
    return value;
  }
  async function request(path, init = {}, guest = false) {
    const headers = new Headers(init.headers);
    if (cross) {
      headers.set('X-Arling-Client', 'web');
      if (!guest && session) {
        headers.set('Authorization', `Bearer ${session.accessToken}`);
        if (init.method && init.method !== 'GET') headers.set('X-CSRF-Token', session.csrfToken);
      }
    }
    const result = await fetch(new URL('api/' + path, endpoint), { ...init, headers,
      credentials: cross ? 'omit' : 'same-origin', cache: 'no-store', referrerPolicy: 'no-referrer' });
    if ((!guest && result.status === 401) || (path === 'auth/logout' && result.ok)) clear();
    return result;
  }
  return { request, remember, clear };
}
