// WebSocket-URL till backend.
//
// Split-deploy (frontend på Cloudflare Pages, backend på egen host): sätt
// VITE_SERVER_URL vid bygget, t.ex. https://timglas.fly.dev.
// Annars används samma origin – gäller lokalt, via quick tunnel, och när
// Node-servern själv levererar frontenden.
export function serverWsUrl(): string {
  const base = import.meta.env.VITE_SERVER_URL;
  if (base) {
    const u = new URL(base);
    const proto = u.protocol === 'https:' || u.protocol === 'wss:' ? 'wss' : 'ws';
    return `${proto}://${u.host}/ws`;
  }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}
