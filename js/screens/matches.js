/**
 * Matches list screen.
 *
 * Shows all swaps for the current user, filtered by status tab.
 * Tap a row → load that swap into AppState → navigateTo('chat')
 *
 * Data: getMySwaps(userId) — joined query returning swap + both items
 */

import { AppState, setState } from '../state.js';
import { navigateTo }         from '../router.js';
import { getMySwaps }         from '../api.js';
import { cached }             from '../cache.js';

// ── Render ────────────────────────────────────────────────────────────────────

export async function renderMatches() {
  const panel = document.getElementById('left-nav-panel');
  if (!panel) return;

  panel.innerHTML = _html(null, 'active');
  _bindDOM(null, 'active');

  const userId = AppState.user?.id;
  if (!userId) return;

  const { data, error } = await cached('swaps', () => getMySwaps(userId), 30_000);
  const swaps = error ? [] : (data ?? []);

  const activeFilter = panel.querySelector('[data-filter].chip--active')?.dataset.filter || 'active';
  panel.innerHTML = _html(swaps, activeFilter);
  _bindDOM(swaps, activeFilter);
  if (window.lucide) window.lucide.createIcons();
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function _html(swaps, activeFilter) {
  const counts = _counts(swaps);
  return `
    <div class="matches-screen">

      <div class="matches-header">
        <h2>Your swaps</h2>
      </div>

      <div class="matches-filters" role="group" aria-label="Filter swaps">
        ${_chipHTML('active',    `Active (${counts.active})`,    activeFilter)}
        ${_chipHTML('done',      'Done',                         activeFilter)}
        ${_chipHTML('cancelled', 'Cancelled',                    activeFilter)}
      </div>

      <div class="matches-list" id="matches-list">
        ${swaps === null
          ? _skeleton()
          : _filteredRows(swaps, activeFilter)
        }
      </div>

    </div>
  `;
}

function _chipHTML(value, label, activeFilter) {
  const isActive = value === activeFilter;
  return `
    <button class="chip ${isActive ? 'chip--active' : ''}" data-filter="${value}">
      ${_esc(label)}
    </button>
  `;
}

function _filteredRows(swaps, filter) {
  const filtered = swaps.filter(s => _statusGroup(s.status) === filter);
  if (filtered.length === 0) return _empty();
  return filtered.map(s => _rowHTML(s)).join('');
}

function _rowHTML(swap) {
  const myId      = AppState.user?.id;
  const itemA     = swap['items!swaps_item_a_id_fkey'];
  const itemB     = swap['items!swaps_item_b_id_fkey'];
  const myItem    = swap.user_a_id === myId ? itemA : itemB;
  const theirItem = swap.user_a_id === myId ? itemB : itemA;

  const theirName  = _esc(theirItem?.owner || 'Swapper');
  const myTitle    = _esc(myItem?.title || 'Your item');
  const theirTitle = _esc(theirItem?.title || 'Their item');
  const status     = swap.status || 'pending';
  const updated    = _relTime(swap.updated_at || swap.created_at);
  const initials   = _initials(theirItem?.owner || 'S');

  return `
    <div class="swap-row" data-swap-id="${_esc(swap.id)}" role="button" tabindex="0"
      aria-label="Swap with ${theirName}">

      <div class="swap-row-avatar" aria-hidden="true">${initials}</div>

      <div class="swap-row-body">
        <div class="swap-row-title">${theirName} &middot; ${myTitle} &#x21C4; ${theirTitle}</div>
        <div class="swap-row-preview">Tap to open chat</div>
      </div>

      <div class="swap-row-meta">
        ${_statusChip(status)}
        <span class="swap-row-time">${updated}</span>
      </div>

    </div>
  `;
}

function _statusChip(status) {
  const group = _statusGroup(status);
  if (group === 'active' && (status === 'pending' || status === 'new')) {
    return `<span class="status-chip status-chip--new">New</span>`;
  }
  if (group === 'active' && status === 'active') {
    return `<span class="status-chip status-chip--chatting">Chatting</span>`;
  }
  if (status === 'meetup' || status === 'meetup_set') {
    return `<span class="status-chip status-chip--meetup">Meetup set</span>`;
  }
  if (group === 'done') {
    return `<span class="status-chip status-chip--done">Done</span>`;
  }
  return `<span class="status-chip status-chip--new">${_esc(status)}</span>`;
}

function _skeleton() {
  return Array.from({ length: 3 }, () => `
    <div class="swap-row" style="pointer-events:none;opacity:0.5;">
      <div class="swap-row-avatar" aria-hidden="true" style="background:var(--surface-alt);"></div>
      <div class="swap-row-body">
        <div style="height:14px;width:70%;background:var(--surface-alt);border-radius:6px;margin-bottom:8px;"></div>
        <div style="height:12px;width:45%;background:var(--surface-alt);border-radius:6px;"></div>
      </div>
    </div>
  `).join('');
}

function _empty() {
  return `
    <div class="matches-empty">
      <i data-lucide="arrow-left-right" style="width:40px;height:40px;color:var(--text-muted);"></i>
      <h3>No swaps yet</h3>
      <p>Go hunt for something you love!</p>
      <button class="btn btn-primary" id="btn-matches-discover">
        Start hunting
      </button>
    </div>
  `;
}

// ── DOM binding ───────────────────────────────────────────────────────────────

let _panelClickHandler = null;

function _bindDOM(swaps, currentFilter) {
  const panel = document.getElementById('left-nav-panel');
  if (!panel) return;

  if (_panelClickHandler) panel.removeEventListener('click', _panelClickHandler);

  _panelClickHandler = (e) => {
    // Empty state CTA
    if (e.target.closest('#btn-matches-discover')) {
      navigateTo('swipe');
      return;
    }

    // Filter chips
    const chip = e.target.closest('[data-filter]');
    if (chip && swaps) {
      const filter = chip.dataset.filter;
      panel.innerHTML = _html(swaps, filter);
      _bindDOM(swaps, filter);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Swap row tap
    const row = e.target.closest('[data-swap-id]');
    if (row && swaps) {
      const swapId = row.dataset.swapId;
      const swap   = swaps.find(s => s.id === swapId);
      if (!swap) return;

      const myId      = AppState.user?.id;
      const itemA     = swap['items!swaps_item_a_id_fkey'];
      const itemB     = swap['items!swaps_item_b_id_fkey'];
      const theirItem = swap.user_a_id === myId ? itemB : itemA;

      setState({ matchedSwap: swap, matchedItem: theirItem });
      navigateTo('chat');
    }
  };

  panel.addEventListener('click', _panelClickHandler);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _statusGroup(status) {
  if (status === 'completed' || status === 'done') return 'done';
  if (status === 'cancelled') return 'cancelled';
  return 'active';
}

function _counts(swaps) {
  if (!swaps) return { active: 0, done: 0, cancelled: 0 };
  return swaps.reduce((acc, s) => {
    const g = _statusGroup(s.status);
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, { active: 0, done: 0, cancelled: 0 });
}

function _initials(name) {
  return String(name).trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function _relTime(iso) {
  if (!iso) return '';
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
