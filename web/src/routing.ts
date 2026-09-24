// Tävling anges i URL:en som /t/<slug> (eller ?t=<slug>).
export function parseSlug(): string | null {
  const path = location.pathname.match(/^\/t\/([^/]+)/);
  if (path) return normalize(decodeURIComponent(path[1]));
  const query = new URLSearchParams(location.search).get('t');
  return query ? normalize(query) : null;
}

export function setSlugInUrl(slug: string): void {
  history.pushState(null, '', `/t/${encodeURIComponent(slug)}`);
}

/** Admin-nyckel ur URL:en (?admin=<nyckel>). Returnerar undefined om parametern saknas. */
export function parseAdminKey(): string | undefined {
  const q = new URLSearchParams(location.search).get('admin');
  return q == null ? undefined : q;
}

export function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);
}
