/**
 * Absolute URL for an in-app route, honouring the deploy subpath.
 *
 * Supabase needs an absolute redirect target, and `window.location.origin` is
 * scheme + host + port only — it drops the path entirely. Served from a
 * subpath (the UTSC host serves this out of a user directory), building a
 * redirect as `${window.location.origin}/dashboard` therefore pointed at the
 * server root rather than at the app, so OAuth and password-reset round trips
 * landed on a 404 in production while working fine on localhost.
 */
export function appUrl(path: string): string {
  return resolveAppUrl(path, window.location.origin, import.meta.env.BASE_URL);
}

/**
 * The resolution itself, with the two ambient inputs passed in so it can be
 * tested without a real `window` or a rebuilt `BASE_URL`.
 *
 * `base` is Vite's BASE_URL, which is guaranteed to start and end with a slash.
 * A leading slash on `path` would reset resolution back to the origin and drop
 * the subpath again — the exact bug this exists to fix — so strip it.
 */
export function resolveAppUrl(path: string, origin: string, base: string): string {
  return new URL(path.replace(/^\/+/, ''), origin + base).toString();
}
