/**
 * Activity feed screen.
 *
 * Shows a reverse-chronological list of events for the current user:
 *   - New match (mutual like detected)
 *   - Swap confirmed (status → active)
 *   - Swap completed
 *   - Swap cancelled
 *   - Rating received
 *
 * Data source: getMySwaps() — events are derived from swap status + timestamps.
 * Tap a swap event → load swap into state → navigateTo('chat')
 */

import { AppState, setState } from '../state.js';
import { navigateTo }         from '../router.js';
import { getMySwaps }         from '../api.js';
import { cached }             from '../cache.js';

// ── Render ────────────────────────────────────────────────────────────────────

export async function renderActivity() {
  const panel = document.getElementById('left-nav-panel');
  if (!panel) return;

  panel.innerHTML = _html(null, []);
  if (window.lucide) window.lucide.createIcons();

  const userId = AppState.user?.id;
  if (!userId) return;

  const { data, error } = await cached('swaps', () => getMySwaps(userId), 30_000);
  const swaps  = error ? [] : (data ?? []);
  const events = _deriveEvents(swaps, userId);

  panel.innerHTML = _html(events, swaps);
  _bindDOM(swaps);
  if (window.lucide) window.lucide.createIcons();
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function _html(events, swaps) {
  const loading = events === null;
  return `
    <div class="activity-screen">

      <div class="activity-header">
        <h2>Activity</h2>
      </div>

      <div class="activity-scroll" id="activity-scroll">
        ${loading
          ? _skeleton()
          : events.length === 0
            ? _empty()
            : _groupedHTML(events)
        }
      </div>

    </div>
  `;
}

function _groupedHTML(events) {
  const today     = _dayLabel(new Date());
  const yesterday = _dayLabel(new Date(Date.now() - 86400000));

  const groups = {};
  for (const ev of events) {
    const label = groups[ev.dayLabel] ? ev.dayLabel : ev.dayLabel;
    if (!groups[ev.dayLabel]) groups[ev.dayLabel] = [];
    groups[ev.dayLabel].push(ev);
  }

  return Object.entries(groups).map(([label, rows], gi) => `
    <div class="activity-day-group">
      <div class="activity-day-label">${_esc(label)}</div>
      ${rows.map((ev, i) => _eventHTML(ev, i < rows.length - 1)).join('')}
    </div>
  `).join('');
}

function _eventHTML(ev, showDivider) {
  const { iconName, avatarMod, title, sub, swapId, type, rightHTML } = ev;
  return `
    <div class="activity-row ${swapId ? 'activity-row--tappable' : ''}"
      ${swapId ? `data-swap-id="${_esc(swapId)}" role="button" tabindex="0"` : ''}
      aria-label="${_esc(title)}">

      <div class="activity-avatar activity-avatar--${avatarMod}" aria-hidden="true">
        <i data-lucide="${iconName}"></i>
      </div>

      <div class="activity-body">
        <div class="activity-title">${_esc(title)}</div>
        <div class="activity-sub">${_esc(sub)}</div>
      </div>

      <div class="activity-right">
        ${rightHTML || ''}
      </div>

    </div>
    ${showDivider ? '<div style="height:1px;background:var(--line-solid);margin:0 4px;"></div>' : ''}
  `;
}

function _skeleton() {
  return Array.from({ length: 4 }, () => `
    <div class="activity-row" style="pointer-events:none;opacity:0.5;">
      <div class="activity-avatar" style="background:var(--surface-alt);"></div>
      <div class="activity-body">
        <div style="height:14px;width:70%;background:var(--surface-alt);border-radius:6px;margin-bottom:8px;"></div>
        <div style="height:12px;width:45%;background:var(--surface-alt);border-radius:6px;"></div>
      </div>
    </div>
  `).join('');
}

function _empty() {
  return `
    <div class="activity-empty">
      <i data-lucide="bell" style="width:40px;height:40px;color:var(--text-muted);"></i>
      <h3>Nothing yet</h3>
      <p>Your swap activity will show up here.</p>
    </div>
  `;
}

// ── Event derivation ──────────────────────────────────────────────────────────

function _deriveEvents(swaps, myId) {
  const events = [];

  for (const swap of swaps) {
    const itemA     = swap['items!swaps_item_a_id_fkey'];
    const itemB     = swap['items!swaps_item_b_id_fkey'];
    const myItem    = swap.user_a_id === myId ? itemA : itemB;
    const theirItem = swap.user_a_id === myId ? itemB : itemA;
    const name      = theirItem?.owner || 'Someone';
    const myTitle   = myItem?.title   || 'your item';
    const theirTitle = theirItem?.title || 'their item';
    const status    = swap.status;
    const ts        = swap.updated_at || swap.created_at;
    const time      = _timeLabel(ts);
    const dayLabel  = _dayLabelFromISO(ts);

    if (status === 'pending') {
      events.push({
        type:      'match',
        iconName:  'arrow-left-right',
        avatarMod: 'swap',
        title:     `New match with ${name}`,
        sub:       `${theirTitle} \u21C4 ${myTitle} \u00B7 ${time}`,
        dayLabel,
        ts,
        swapId:    swap.id,
        rightHTML: `<button class="activity-chat-btn" data-swap-id="${_esc(swap.id)}">Chat</button>`,
      });
    } else if (status === 'active') {
      events.push({
        type:      'confirmed',
        iconName:  'check-circle',
        avatarMod: 'swap',
        title:     `Swap confirmed with ${name}`,
        sub:       `${theirTitle} \u00B7 ${time}`,
        dayLabel,
        ts,
        swapId:    swap.id,
        rightHTML: '',
      });
    } else if (status === 'completed') {
      events.push({
        type:      'completed',
        iconName:  'package-check',
        avatarMod: 'star',
        title:     `Swap completed with ${name}`,
        sub:       `${theirTitle} \u00B7 ${time}`,
        dayLabel,
        ts,
        swapId:    null,
        rightHTML: '',
      });
    } else if (status === 'cancelled') {
      events.push({
        type:      'cancelled',
        iconName:  'x-circle',
        avatarMod: 'eye',
        title:     `Swap cancelled`,
        sub:       `With ${name} \u00B7 ${theirTitle} \u00B7 ${time}`,
        dayLabel,
        ts,
        swapId:    null,
        rightHTML: '',
      });
    }
  }

  // Most recent first
  events.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  return events;
}

// ── DOM binding ───────────────────────────────────────────────────────────────

let _panelClickHandler = null;

function _bindDOM(swaps) {
  const panel = document.getElementById('left-nav-panel');
  if (!panel) return;

  if (_panelClickHandler) panel.removeEventListener('click', _panelClickHandler);

  _panelClickHandler = (e) => {
    const row = e.target.closest('[data-swap-id]');
    if (!row || !swaps) return;

    const swapId = row.dataset.swapId;
    const swap   = swaps.find(s => s.id === swapId);
    if (!swap) return;

    const myId      = AppState.user?.id;
    const itemA     = swap['items!swaps_item_a_id_fkey'];
    const itemB     = swap['items!swaps_item_b_id_fkey'];
    const theirItem = swap.user_a_id === myId ? itemB : itemA;

    setState({ matchedSwap: swap, matchedItem: theirItem });
    navigateTo('chat');
  };

  panel.addEventListener('click', _panelClickHandler);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _dayLabel(date) {
  const today = new Date();
  const d     = new Date(date);
  const todayStr     = today.toDateString();
  const yesterdayStr = new Date(today - 86400000).toDateString();
  if (d.toDateString() === todayStr)     return 'TODAY';
  if (d.toDateString() === yesterdayStr) return 'YESTERDAY';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
}

function _dayLabelFromISO(iso) {
  if (!iso) return 'EARLIER';
  return _dayLabel(new Date(iso));
}

function _timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
