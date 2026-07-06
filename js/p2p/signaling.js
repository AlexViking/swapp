/**
 * WebRTC signaling via Supabase Realtime.
 *
 * Flow:
 *  1. Both peers join channel `swap:<swapId>`
 *  2. Caller sends { type:'offer',  sdp }
 *  3. Callee sends { type:'answer', sdp }
 *  4. Both exchange { type:'ice', candidate }
 *  5. Once RTCDataChannel opens, signaling channel is torn down
 *
 * No messages are stored — Realtime is used as a transient pipe only.
 */

import { supabase }  from '../api.js';
import { AppState, setState } from '../state.js';
import { initDataChannel } from './chat.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Join the signaling channel for a swap and begin WebRTC negotiation.
 * The first peer to arrive becomes the "caller" (creates offer).
 * The second becomes the "callee" (creates answer).
 *
 * @param {string} swapId
 * @param {function} onMessage  called with each { from, text, ts } data message
 * @param {function} onStatus   called with 'connecting' | 'open' | 'closed'
 */
export async function connectToActiveChatRoom(swapId, onMessage, onStatus) {
  // Clean up any existing connection first
  disconnectChat();

  const channelName = `swap:${swapId}`;
  const myId = AppState.user?.id;

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  setState({ peerConnection: pc });

  // ── ICE candidate handler ─────────────────────────────────────────────────
  pc.onicecandidate = ({ candidate }) => {
    if (!candidate) return;
    const ch = AppState.activeChatChannel;
    if (ch) ch.send({ type: 'broadcast', event: 'signal', payload: { type: 'ice', from: myId, candidate } });
  };

  // ── DataChannel (caller creates, callee receives) ─────────────────────────
  let dc;

  pc.ondatachannel = (event) => {
    dc = event.channel;
    _setupDataChannel(dc, onMessage, onStatus, swapId);
  };

  // ── Realtime signaling channel ────────────────────────────────────────────
  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false } },
  });

  setState({ activeChatChannel: channel });

  channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
    if (!payload || payload.from === myId) return;

    if (payload.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'answer', from: myId, sdp: answer } });

    } else if (payload.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

    } else if (payload.type === 'ice') {
      try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch (_) { /* ignore stale */ }

    } else if (payload.type === 'presence') {
      // Second peer joined — we're the caller, create offer + data channel
      if (payload.peerCount === 2) {
        dc = pc.createDataChannel('chat', { ordered: true });
        _setupDataChannel(dc, onMessage, onStatus, swapId);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'offer', from: myId, sdp: offer } });
      }
    }
  });

  onStatus?.('connecting');

  await new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
    });
  });

  // Announce presence; if a second peer is already here, trigger offer
  const presenceKey = myId;
  await channel.track({ user_id: myId });

  // Count presence — if 2 peers, signal to all via broadcast
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const peerCount = Object.keys(state).length;
    if (peerCount >= 2) {
      channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'presence', from: myId, peerCount } });
    }
  });

  return channel;
}

export function disconnectChat() {
  const { peerConnection, dataChannel, activeChatChannel } = AppState;

  if (dataChannel) {
    try { dataChannel.close(); } catch (_) {}
  }
  if (peerConnection) {
    try { peerConnection.close(); } catch (_) {}
  }
  if (activeChatChannel) {
    try { supabase.removeChannel(activeChatChannel); } catch (_) {}
  }

  setState({ peerConnection: null, dataChannel: null, activeChatChannel: null });
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _setupDataChannel(dc, onMessage, onStatus, swapId) {
  setState({ dataChannel: dc });
  initDataChannel(dc);

  dc.onopen = () => {
    onStatus?.('open');
    // Tear down signaling channel — no longer needed
    const ch = AppState.activeChatChannel;
    if (ch) {
      try { supabase.removeChannel(ch); } catch (_) {}
      setState({ activeChatChannel: null });
    }
  };

  dc.onclose = () => onStatus?.('closed');

  dc.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      onMessage?.(msg);
    } catch (_) { /* ignore malformed */ }
  };
}
