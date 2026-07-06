/**
 * Cancel screen.
 *
 * Shown when a user taps "Cancel" from the chat screen.
 * Renders as a bottom sheet over the chat panel.
 * User must select a reason before confirming cancellation.
 *
 * On confirm → updateSwapStatus('cancelled', reason) → navigateTo('rate')
 *              (post-cancel rating, rateContext = 'cancel')
 * On back    → navigateTo('chat')
 */

import { AppState, setState } from '../state.js';
import { navigateTo }         from '../router.js';
import { updateSwapStatus }   from '../api.js';
import { invalidate }         from '../cache.js';

const REASONS = [
  { id: 0, label: 'Changed my mind about my item' },
  { id: 1, label: "We couldn't agree on a meetup" },
  { id: 2, label: 'The other person stopped replying' },
  { id: 3, label: "Item isn't what I expected" },
  { id: 4, label: 'Something else\u2026' },
];

// ── Render ────────────────────────────────────────────────────────────────────

export function renderCancel() {
  const panel = document.getElementById('right-chat-panel');
  if (!panel) return;

  const swap = AppState.matchedSwap;
  if (!swap) { navigateTo('matches'); return; }

  const partnerName = _esc(AppState.matchedItem?.owner || 'them');

  panel.innerHTML = _html(partnerName);
  _bindDOM(swap);
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function _html(partnerName) {
  const selected = AppState.cancelReason;

  return `
    <div class="sheet-overlay" id="cancel-sheet-overlay">
      <div class="sheet">

        <div class="sheet-grabber" aria-hidden="true"></div>

        <h3 class="cancel-title">Cancel this swap?</h3>

        <p class="cancel-sub">
          No hard feelings — just tell ${partnerName} why, so nobody's left waiting.
        </p>

        <div class="cancel-reasons" id="cancel-reasons">
          ${REASONS.map(r => `
            <div
              class="cancel-reason-row${selected === r.id ? ' selected' : ''}"
              data-reason="${r.id}"
              role="radio"
              aria-checked="${selected === r.id}"
              tabindex="0"
            >
              <div class="radio"></div>
              <span>${_esc(r.label)}</span>
            </div>
          `).join('')}
        </div>

        <div class="cancel-note">
          <textarea
            class="input"
            id="cancel-note-text"
            rows="3"
            placeholder="Add a note (optional)"
          ></textarea>
        </div>

        <button
          class="btn btn--danger"
          id="btn-cancel-confirm"
          style="width:100%;"
          ${selected === -1 ? 'disabled' : ''}
        >
          Cancel the swap
        </button>

        <button class="btn btn--ghost" id="btn-cancel-keep" style="width:100%;">
          Never mind, keep it going
        </button>

      </div>
    </div>
  `;
}

// ── DOM binding ───────────────────────────────────────────────────────────────

function _bindDOM(swap) {
  const panel = document.getElementById('right-chat-panel');
  if (!panel) return;

  panel.addEventListener('click', (e) => {
    const reasonRow = e.target.closest('[data-reason]');
    if (reasonRow) {
      const id = parseInt(reasonRow.dataset.reason, 10);
      setState({ cancelReason: id });
      _refreshReasons(id);
      _refreshConfirmBtn(id);
      return;
    }

    const id = e.target.closest('[id]')?.id;
    switch (id) {
      case 'btn-cancel-keep':
        navigateTo('chat');
        break;
      case 'btn-cancel-confirm':
        _confirmCancel(swap);
        break;
    }
  });

  // Keyboard accessibility for reason rows
  panel.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      const reasonRow = e.target.closest('[data-reason]');
      if (reasonRow) {
        e.preventDefault();
        reasonRow.click();
      }
    }
  });
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function _confirmCancel(swap) {
  const reason = AppState.cancelReason;
  if (reason === -1) return;

  const reasonLabel = REASONS.find(r => r.id === reason)?.label ?? '';
  const note = document.getElementById('cancel-note-text')?.value.trim() || '';
  const fullReason = note ? `${reasonLabel}: ${note}` : reasonLabel;

  const { error } = await updateSwapStatus(swap.id, 'cancelled', fullReason);
  if (error) { console.error('cancel swap', error); return; }

  invalidate('swaps'); // swap status changed

  setState({
    matchedSwap: { ...swap, status: 'cancelled' },
    rateContext: 'cancel',
    cancelReason: -1,
  });

  navigateTo('rate');
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function _refreshReasons(selectedId) {
  document.querySelectorAll('.cancel-reason-row').forEach(row => {
    const id = parseInt(row.dataset.reason, 10);
    const active = id === selectedId;
    row.classList.toggle('selected', active);
    row.setAttribute('aria-checked', String(active));
  });
}

function _refreshConfirmBtn(selectedId) {
  const btn = document.getElementById('btn-cancel-confirm');
  if (btn) btn.disabled = selectedId === -1;
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
