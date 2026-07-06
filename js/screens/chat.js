/**
 * Chat screen.
 *
 * Layout (top → bottom):
 *   1. Header — back btn, avatar + name + P2P status, menu btn
 *   2. Pinned swap context card — item pair thumbnails + arrow icon + status badge
 *   3. Swap action bar — context-aware buttons (Confirm / Complete / Cancel)
 *   4. Message list — scrollable, bubbles left (theirs) / right (mine), E2E notice
 *   5. Composer — pill input + circle send btn
 *
 * P2P:
 *   - connectToActiveChatRoom() opens the Supabase Realtime signaling channel
 *   - Once RTCDataChannel opens, signaling is torn down; messages flow P2P
 *   - No messages stored server-side — fully ephemeral
 *
 * Swap actions:
 *   pending  → [Confirm swap] [Cancel]
 *   active   → [Mark complete] [Cancel]
 *   otherwise → no action bar
 */

import { AppState, setState }           from '../state.js';
import { navigateTo }                   from '../router.js';
import { updateSwapStatus }             from '../api.js';
import { invalidate }                   from '../cache.js';
import { connectToActiveChatRoom, disconnectChat } from '../p2p/signaling.js';
import { sendMessage }                  from '../p2p/chat.js';

// Local message log — cleared on each new swap chat
let _messages   = [];
let _chatStatus = 'idle'; // 'idle' | 'connecting' | 'open' | 'closed'

// ── Render ────────────────────────────────────────────────────────────────────

export function renderChat() {
  const panel = document.getElementById('right-chat-panel');
  if (!panel) return;

  const swap    = AppState.matchedSwap;
  const matched = AppState.matchedItem;
  const offer   = AppState.myItems?.[AppState.offerIndex];
  const myId    = AppState.user?.id;

  if (!swap || !matched) {
    navigateTo('matches');
    return;
  }

  panel.innerHTML = _html(swap, matched, offer, myId);
  _bindDOM(swap);

  // Start WebRTC if not already connected
  if (_chatStatus === 'idle' || _chatStatus === 'closed') {
    _connect(swap.id);
  }

  if (window.lucide) window.lucide.createIcons();
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function _html(swap, matched, offer, myId) {
  const ownerName  = _esc(matched.owner || 'them');
  const ownerInit  = (matched.owner || 'T')[0].toUpperCase();
  const offerThumb = _thumb(offer);
  const matchThumb = _thumb(matched);
  const status     = swap.status || 'pending';

  const offerTitle = _esc(offer?.title || 'Your item');
  const matchTitle = _esc(matched.title || 'Their item');

  return `
    <div class="chat-screen">

      <!-- Header -->
      <div class="chat-header">
        <button class="back-btn" id="btn-chat-back" aria-label="Back">
          <i data-lucide="arrow-left"></i>
        </button>

        <div class="chat-header-identity">
          <div class="chat-peer-avatar">${_esc(ownerInit)}</div>
          <div style="min-width:0;">
            <div class="chat-name">${ownerName}</div>
            <div class="chat-status ${_statusClass(_chatStatus)}" id="chat-status">
              ${_statusLabel(_chatStatus)}
            </div>
          </div>
        </div>

        <button class="chat-menu-btn back-btn" id="btn-chat-menu" aria-label="More options">
          <i data-lucide="more-horizontal"></i>
        </button>
      </div>

      <!-- Pinned swap context card -->
      <div class="swap-context-card">
        ${offerThumb
          ? `<div class="swap-ctx-thumb" style="background-image:url('${_esc(offerThumb)}');"></div>`
          : `<div class="swap-ctx-thumb"></div>`
        }
        <i data-lucide="arrow-left-right" class="swap-ctx-icon"></i>
        ${matchThumb
          ? `<div class="swap-ctx-thumb" style="background-image:url('${_esc(matchThumb)}');"></div>`
          : `<div class="swap-ctx-thumb"></div>`
        }
        <div class="swap-ctx-info">
          <div class="swap-ctx-title">${offerTitle} ⇄ ${matchTitle}</div>
          <div class="swap-ctx-status">${_swapStatusLabel(status)}</div>
        </div>
        <button class="swap-ctx-details back-btn" id="btn-swap-details" aria-label="Swap details">
          details
        </button>
      </div>

      <!-- Swap action bar -->
      ${_actionBar(status)}

      <!-- Message list -->
      <div class="chat-messages" id="chat-messages">
        ${_chatStatus === 'connecting' ? _connectingOverlay() : ''}
        ${_messages.map(m => _bubbleHTML(m, myId)).join('')}
        ${_messages.length > 0
          ? `<div class="chat-e2e">delivered · encrypted device-to-device</div>`
          : ''}
      </div>

      <!-- Composer -->
      <div class="chat-composer">
        <textarea
          class="chat-input"
          id="chat-input"
          placeholder="Message…"
          rows="1"
          ${_chatStatus !== 'open' ? 'disabled' : ''}
          aria-label="Message input"
        ></textarea>
        <button class="chat-send-btn" id="btn-chat-send"
          ${_chatStatus !== 'open' ? 'disabled' : ''}
          aria-label="Send message">
          <i data-lucide="send"></i>
        </button>
      </div>

    </div>
  `;
}

function _actionBar(status) {
  if (status === 'pending') {
    return `
      <div class="chat-action-bar">
        <button class="btn chat-btn-confirm" id="btn-swap-confirm">Confirm swap</button>
        <button class="btn chat-btn-cancel"  id="btn-swap-cancel">Cancel</button>
      </div>
    `;
  }
  if (status === 'active') {
    return `
      <div class="chat-action-bar">
        <button class="btn chat-btn-complete" id="btn-swap-complete">Mark complete</button>
        <button class="btn chat-btn-cancel"   id="btn-swap-cancel">Cancel</button>
      </div>
    `;
  }
  return '';
}

function _connectingOverlay() {
  return `
    <div class="chat-connecting" id="chat-connecting">
      <i data-lucide="clock" style="width:28px;height:28px;color:var(--brass);"></i>
      <p>Connecting peer-to-peer…</p>
    </div>
  `;
}

function _bubbleHTML(msg, myId) {
  const mine = msg.from === myId;
  const time = _formatTime(msg.ts);
  return `
    <div class="chat-bubble ${mine ? 'me' : 'them'}">
      <span>${_esc(msg.text)}</span>
      <span style="font-size:10px;opacity:0.6;align-self:flex-end;margin-top:2px;">${time}</span>
    </div>
  `;
}

function _statusLabel(s) {
  if (s === 'connecting') return '<i data-lucide="clock" style="width:12px;height:12px;display:inline;vertical-align:middle;"></i> connecting…';
  if (s === 'open')       return '● connected · peer-to-peer';
  if (s === 'closed')     return '<i data-lucide="wifi-off" style="width:12px;height:12px;display:inline;vertical-align:middle;"></i> offline';
  return '<i data-lucide="wifi-off" style="width:12px;height:12px;display:inline;vertical-align:middle;"></i> offline';
}

function _statusClass(s) {
  if (s === 'open')       return 'chat-status--connected';
  if (s === 'connecting') return 'chat-status--connecting';
  return '';
}

function _swapStatusLabel(status) {
  const map = {
    pending:   'Awaiting confirmation',
    active:    'Swap in progress',
    completed: 'Swap complete',
    cancelled: 'Cancelled',
  };
  return map[status] ?? status;
}

// ── DOM binding ───────────────────────────────────────────────────────────────

function _bindDOM(swap) {
  const panel = document.getElementById('right-chat-panel');
  if (!panel) return;
  panel.addEventListener('click', (e) => _handleClick(e, swap));

  // Send on Enter (not Shift+Enter)
  const input = document.getElementById('chat-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _send();
      }
    });
    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
  }
}

function _handleClick(e, swap) {
  const id = e.target.closest('[id]')?.id;
  switch (id) {
    case 'btn-chat-back':     _back(); break;
    case 'btn-chat-send':     _send(); break;
    case 'btn-swap-confirm':  _updateStatus(swap.id, 'active'); break;
    case 'btn-swap-complete': _updateStatus(swap.id, 'completed'); break;
    case 'btn-swap-cancel':   navigateTo('cancel'); break;
  }
}

// ── WebRTC connection ─────────────────────────────────────────────────────────

async function _connect(swapId) {
  _chatStatus = 'connecting';
  _refreshStatus();

  await connectToActiveChatRoom(swapId, _onMessage, _onStatus);
}

function _onMessage(msg) {
  _messages.push(msg);
  _appendBubble(msg);
}

function _onStatus(status) {
  _chatStatus = status;
  _refreshStatus();

  if (status === 'open') {
    document.getElementById('chat-connecting')?.remove();
    const input = document.getElementById('chat-input');
    const btn   = document.getElementById('btn-chat-send');
    if (input) input.disabled = false;
    if (btn)   btn.disabled   = false;

    // Show E2E notice once connected and there are messages
    _ensureE2eNotice();
  }
}

// ── Messaging ─────────────────────────────────────────────────────────────────

function _send() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const ok = sendMessage(text);
  if (!ok) return;

  // Optimistic: show own bubble immediately
  const msg = { from: AppState.user?.id, text, ts: new Date().toISOString() };
  _messages.push(msg);
  _appendBubble(msg);

  input.value = '';
  input.style.height = 'auto';
  _ensureE2eNotice();
}

function _appendBubble(msg) {
  const list = document.getElementById('chat-messages');
  if (!list) return;
  // Insert before E2E notice if present
  const e2e = list.querySelector('.chat-e2e');
  const html = _bubbleHTML(msg, AppState.user?.id);
  if (e2e) {
    e2e.insertAdjacentHTML('beforebegin', html);
  } else {
    list.insertAdjacentHTML('beforeend', html);
  }
  list.scrollTop = list.scrollHeight;
  if (window.lucide) window.lucide.createIcons();
}

function _ensureE2eNotice() {
  const list = document.getElementById('chat-messages');
  if (!list) return;
  if (!list.querySelector('.chat-e2e') && _messages.length > 0) {
    list.insertAdjacentHTML('beforeend', `<div class="chat-e2e">delivered · encrypted device-to-device</div>`);
  }
}

// ── Swap status actions ───────────────────────────────────────────────────────

async function _updateStatus(swapId, newStatus) {
  const { error } = await updateSwapStatus(swapId, newStatus);
  if (error) { console.error('updateSwapStatus', error); return; }

  invalidate('swaps'); // swap status changed

  setState(s => ({
    matchedSwap: s.matchedSwap ? { ...s.matchedSwap, status: newStatus } : s.matchedSwap,
  }));

  if (newStatus === 'completed') {
    setState({ rateContext: 'complete' });
    navigateTo('rate');
  } else {
    renderChat(); // refresh action bar
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────

function _back() {
  disconnectChat();
  _chatStatus = 'idle';
  _messages   = [];
  navigateTo(AppState.prevScreen || 'matches');
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function _refreshStatus() {
  const el = document.getElementById('chat-status');
  if (!el) return;
  el.className  = `chat-status ${_statusClass(_chatStatus)}`;
  el.innerHTML  = _statusLabel(_chatStatus);
  if (window.lucide) window.lucide.createIcons();
}

function _thumb(item) {
  if (!item) return '';
  return item.images?.[0] ?? item.photo_urls?.[0] ?? (item.seed ? `https://picsum.photos/seed/${item.seed}/200/200` : '');
}

function _formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
