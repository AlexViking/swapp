/**
 * RTCDataChannel helpers.
 *
 * Keeps a reference to the active data channel and provides
 * a clean `sendMessage(text)` API used by the chat screen.
 *
 * Messages are plain JSON: { from: userId, text: string, ts: ISO-string }
 * Nothing is stored anywhere — fully ephemeral P2P.
 */

import { AppState } from '../state.js';

let _dc = null;

/**
 * Store a reference to the opened RTCDataChannel.
 * Called by signaling.js once the channel is set up.
 */
export function initDataChannel(dc) {
  _dc = dc;
}

/**
 * Send a text message over the data channel.
 * Returns true on success, false if channel isn't open.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function sendMessage(text) {
  const dc = _dc ?? AppState.dataChannel;
  if (!dc || dc.readyState !== 'open') return false;

  const msg = {
    from: AppState.user?.id ?? 'unknown',
    text: String(text).trim(),
    ts:   new Date().toISOString(),
  };

  try {
    dc.send(JSON.stringify(msg));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Check if the data channel is currently open.
 * @returns {boolean}
 */
export function isChatOpen() {
  const dc = _dc ?? AppState.dataChannel;
  return dc?.readyState === 'open';
}
