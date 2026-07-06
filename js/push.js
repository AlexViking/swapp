/**
 * Push notifications — Capacitor PushNotifications plugin.
 *
 * Works on:
 *   iOS     — APNs via Capacitor
 *   Android — FCM via Capacitor
 *   Web     — silently no-ops (browser push not implemented; relies on email digest)
 *
 * Flow:
 *   1. initPush() called once after successful login
 *   2. Requests permission → registers with FCM/APNs → sends token to Supabase profile
 *   3. Listens for foreground notifications → shows in-app toast
 *   4. Listens for notification tap → routes to the right screen
 *
 * Respects AppState notification preferences:
 *   notifPush  — master toggle (skip registration if false)
 *   notifMatch — suppress match notifications
 */

import { AppState }     from './state.js';
import { navigateTo }   from './router.js';
import { updateProfile } from './api.js';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise push notifications. Call once after the user is authenticated.
 * Safe to call on web — exits gracefully if Capacitor is not available.
 */
export async function initPush() {
  if (!AppState.notifPush)        return;   // user disabled push
  if (!_isCapacitor())            return;   // running in browser, not native

  const { PushNotifications } = await _loadPlugin();
  if (!PushNotifications)         return;

  // Check / request permission
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt') {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== 'granted') return;

  // Register with FCM / APNs
  await PushNotifications.register();

  // Token received — save to Supabase profile for server-side sending
  PushNotifications.addListener('registration', async ({ value: token }) => {
    const userId = AppState.user?.id;
    if (userId && token) {
      await updateProfile(userId, { push_token: token });
    }
  });

  // Registration error — log only, don't crash the app
  PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] registration error', err);
  });

  // Foreground notification — show an in-app toast
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    if (!_shouldShow(notification)) return;
    _showToast(notification.title ?? 'Swapp', notification.body ?? '');
  });

  // Notification tapped (app was backgrounded or closed)
  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    _handleTap(notification.data ?? {});
  });
}

/**
 * Remove all push listeners and clear the stored token.
 * Call on sign-out.
 */
export async function teardownPush() {
  if (!_isCapacitor()) return;
  const { PushNotifications } = await _loadPlugin();
  PushNotifications?.removeAllListeners();

  const userId = AppState.user?.id;
  if (userId) await updateProfile(userId, { push_token: null });
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _isCapacitor() {
  return typeof window !== 'undefined' && !!(window.Capacitor?.isNativePlatform?.());
}

async function _loadPlugin() {
  try {
    return await import('@capacitor/push-notifications');
  } catch {
    return {};
  }
}

/**
 * Decide whether to surface a foreground notification based on user prefs.
 * The server always sends; we filter client-side so prefs are instant.
 */
function _shouldShow(notification) {
  const type = notification.data?.type ?? '';
  if (type === 'match' && !AppState.notifMatch) return false;
  return true;
}

/**
 * Route a tapped notification to the correct screen.
 * Data payload shape expected from the server:
 *   { type: 'match' | 'swap_update', swap_id?: string }
 */
function _handleTap(data) {
  const { type, swap_id } = data;
  if (type === 'match' || type === 'swap_update') {
    if (swap_id) navigateTo('matches');
  }
}

// ── In-app toast ──────────────────────────────────────────────────────────────

function _showToast(title, body) {
  // Remove any existing toast
  document.getElementById('push-toast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'push-toast';
  toast.className = 'push-toast';
  toast.innerHTML = `
    <span class="push-toast-title">${_esc(title)}</span>
    <span class="push-toast-body">${_esc(body)}</span>
  `;
  toast.addEventListener('click', () => toast.remove());
  document.body.appendChild(toast);

  // Auto-dismiss after 4 seconds
  setTimeout(() => toast.remove(), 4000);
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
