/**
 * Free-tier usage guards.
 *
 * Supabase free tier limits (as of 2025):
 *   DB rows        — 500 MB storage (effectively unlimited for this app)
 *   Edge Functions — 500,000 invocations / month
 *   Realtime       — 200 concurrent connections
 *   R2             — 10 GB storage, 0 egress cost
 *
 * App-level limits we enforce:
 *   Items per user  — 10 active listings max (enforced in Edge Function + here)
 *   Photos per item — 3 max (enforced in upload.js + addItem screen)
 *   Swipe queue     — prefetch max 20 at a time (avoids hammering feed function)
 *
 * This module:
 *   1. checkListingLimit()  — returns { ok, count, max, nearLimit }
 *   2. checkRealtimeSlots() — warns if approaching concurrent connection limit
 *   3. showLimitBanner()    — renders a non-blocking warning banner
 *   4. guardAddItem()       — blocks navigation to addItem if at limit
 */

import { AppState }  from './state.js';
import { getMyItems } from './api.js';

export const LIMITS = {
  ITEMS_PER_USER:   10,
  PHOTOS_PER_ITEM:  3,
  FEED_PAGE_SIZE:   20,
  WARN_THRESHOLD:   0.8,   // show warning at 80% of limit
};

// ── Listing limit ─────────────────────────────────────────────────────────────

/**
 * Fetch current active listing count and return guard state.
 * @returns {{ ok: boolean, count: number, max: number, nearLimit: boolean }}
 */
export async function checkListingLimit() {
  const userId = AppState.user?.id;
  if (!userId) return { ok: true, count: 0, max: LIMITS.ITEMS_PER_USER, nearLimit: false };

  const { data, error } = await getMyItems(userId);
  if (error) return { ok: true, count: 0, max: LIMITS.ITEMS_PER_USER, nearLimit: false };

  const count     = (data ?? []).length;
  const max       = LIMITS.ITEMS_PER_USER;
  const ok        = count < max;
  const nearLimit = count / max >= LIMITS.WARN_THRESHOLD;

  return { ok, count, max, nearLimit };
}

/**
 * Guard navigation to the add item screen.
 * Shows a blocking message if at limit, a soft warning if near limit.
 * Returns true if navigation should proceed.
 *
 * @returns {Promise<boolean>}
 */
export async function guardAddItem() {
  const { ok, count, max, nearLimit } = await checkListingLimit();

  if (!ok) {
    showLimitBanner(
      `You've reached the ${max}-listing limit`,
      'Remove an expired or inactive item before adding a new one.',
      'error'
    );
    return false;
  }

  if (nearLimit) {
    showLimitBanner(
      `${count} of ${max} listings used`,
      `You can add ${max - count} more item${max - count === 1 ? '' : 's'}.`,
      'warn'
    );
  }

  return true;
}

// ── Banner UI ─────────────────────────────────────────────────────────────────

/**
 * Show a non-blocking usage warning banner above the tab bar.
 * Auto-dismisses after 5 seconds. Replaces any existing banner.
 *
 * @param {string} title
 * @param {string} body
 * @param {'warn'|'error'} level
 */
export function showLimitBanner(title, body, level = 'warn') {
  document.getElementById('limit-banner')?.remove();

  const el = document.createElement('div');
  el.id = 'limit-banner';
  el.className = `limit-banner limit-banner--${level}`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <div class="limit-banner-content">
      <span class="limit-banner-title">${_esc(title)}</span>
      <span class="limit-banner-body">${_esc(body)}</span>
    </div>
    <button class="limit-banner-close" aria-label="Dismiss">✕</button>
  `;

  el.querySelector('.limit-banner-close').addEventListener('click', () => el.remove());
  document.body.appendChild(el);

  if (level === 'warn') setTimeout(() => el.remove(), 5000);
}

// ── Photo limit guard ─────────────────────────────────────────────────────────

/**
 * Returns true if the user can add more photos.
 * @param {number} currentCount
 * @returns {boolean}
 */
export function canAddPhoto(currentCount) {
  return currentCount < LIMITS.PHOTOS_PER_ITEM;
}

// ── Realtime connection guard ─────────────────────────────────────────────────

/**
 * Warn if too many Realtime channels are open simultaneously.
 * Supabase free tier: 200 concurrent connections across all users.
 * We keep it safe by limiting to 2 per session (signaling + presence).
 */
export function checkRealtimeChannels(supabaseClient) {
  try {
    const channels = supabaseClient.getChannels?.() ?? [];
    if (channels.length > 3) {
      console.warn(
        `[freeTier] ${channels.length} Realtime channels open — expected ≤2. ` +
        'Check for leaked channels (disconnected signaling not removed).'
      );
    }
  } catch (_) { /* non-critical */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
