/**
 * Resilience — offline detection + localStorage swipe retry queue.
 * Keeps the backend stateless; client owns retry responsibility.
 */

import { AppState, setState } from './state.js';
import { recordSwipe } from './api.js';

const QUEUE_KEY = 'swapp_pending_swipes';

// --- Offline detection ---

export function initResilience() {
  window.addEventListener('online',  handleOnline);
  window.addEventListener('offline', handleOffline);
  // Restore any queued swipes from a previous session
  loadQueue();
}

function handleOnline() {
  setState({ online: true });
  document.getElementById('offline-banner')?.classList.add('hidden');
  flushQueue();
}

function handleOffline() {
  setState({ online: false });
  document.getElementById('offline-banner')?.classList.remove('hidden');
}

// --- Retry queue ---

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (raw) setState({ pendingSwipes: JSON.parse(raw) });
  } catch (_) {
    // corrupt storage — ignore
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (_) {}
}

/**
 * Queue a swipe to be sent when back online.
 * Called by swipe screen when AppState.online === false.
 */
export function enqueueSwipe(swipePayload) {
  const queue = [...AppState.pendingSwipes, swipePayload];
  setState({ pendingSwipes: queue });
  saveQueue(queue);
}

/**
 * Drain the queue — called on reconnect.
 */
async function flushQueue() {
  const queue = [...AppState.pendingSwipes];
  if (!queue.length) return;

  const failed = [];
  for (const payload of queue) {
    const { error } = await recordSwipe(payload);
    if (error) failed.push(payload);
  }

  setState({ pendingSwipes: failed });
  saveQueue(failed);
}
