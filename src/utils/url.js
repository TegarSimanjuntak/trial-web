// src/utils/url.js
export function joinApiUrl(base, path = '/api/chat') {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p; // relative path (same origin)

  try {
    // new URL handles trailing slash properly
    return new URL(p, base).toString();
  } catch (e) {
    const b = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${b}${p}`;
  }
}
