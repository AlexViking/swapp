/**
 * cache.js — Simple in-memory TTL cache for API responses.
 *
 * Usage:
 *   import { cached, invalidate } from './cache.js';
 *
 *   // Fetch swaps, cache for 30 s. Returns cached copy on repeat calls.
 *   const { data, error } = await cached('swaps', () => getMySwaps(userId), 30_000);
 *
 *   // Force a fresh fetch next time (e.g. after a mutation)
 *   invalidate('swaps');
 *   invalidate('myItems');
 *
 * Keys used in this app:
 *   'swaps'    — getMySwaps()  — TTL 30 s
 *   'myItems'  — getMyItems()  — TTL 60 s
 *   'profile'  — getProfile()  — TTL 60 s
 *   'feed'     — fetchFeed()   — TTL 120 s (feed is long, rarely changes)
 */

const _store = new Map(); // key → { result, expiresAt }

/**
 * Return cached result if still fresh, otherwise call `fetchFn` and cache it.
 * @param {string} key
 * @param {() => Promise<{data, error}>} fetchFn
 * @param {number} ttlMs   milliseconds before cache entry expires
 */
export async function cached(key, fetchFn, ttlMs) {
  const now = Date.now();
  const entry = _store.get(key);

  if (entry && now < entry.expiresAt) {
    console.log(`[cache] HIT  ${key} (${Math.round((entry.expiresAt - now) / 1000)}s left)`);
    return entry.result;
  }

  console.log(`[cache] MISS ${key} — fetching`);
  const result = await fetchFn();

  if (!result.error) {
    _store.set(key, { result, expiresAt: now + ttlMs });
  }

  return result;
}

/**
 * Invalidate one or more cache keys (e.g. after insert/update/delete).
 * Pass no arguments to clear everything.
 */
export function invalidate(...keys) {
  if (keys.length === 0) {
    _store.clear();
    console.log('[cache] cleared all');
  } else {
    keys.forEach(k => {
      _store.delete(k);
      console.log('[cache] invalidated', k);
    });
  }
}
