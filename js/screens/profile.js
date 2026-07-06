/**
 * Profile screen.
 *
 * Shows:
 *   - Avatar (initials-based), display name, city, member since, rating
 *   - 3 stat tiles: swaps done, on the table, rating
 *   - Hunt radius slider (1–50 km, updates AppState.swapRadius)
 *   - Listings grid (3-col, dashed "+ add" last tile)
 *   - Ghost sign-out button
 *
 * Data:
 *   - AppState.user + AppState.profile for identity
 *   - getMyItems(userId) for listings grid
 *   - getProfile(userId) refreshes profile state
 */

import { AppState, setState } from '../state.js';
import { navigateTo }         from '../router.js';
import { getMyItems, getProfile, deleteItem } from '../api.js';
import { cached, invalidate }                from '../cache.js';

let _manageMode = false;

// ── Render ────────────────────────────────────────────────────────────────────

let _profileLoading = false;

export async function renderProfile() {
  const panel = document.getElementById('left-nav-panel');
  if (!panel) return;

  // If already fetching, just re-render with whatever we have
  if (_profileLoading) {
    panel.innerHTML = _html(AppState.myItems ?? null);
    if (AppState.myItems) _bindDOM(AppState.myItems);
    return;
  }

  const userId = AppState.user?.id;
  if (!userId) return;

  _profileLoading = true;

  // Render skeleton immediately
  panel.innerHTML = _html(null);

  // Fetch items and profile in parallel (cached)
  const [itemsResult, profileResult] = await Promise.all([
    cached('myItems', () => getMyItems(userId), 60_000),
    cached('profile', () => getProfile(userId),  60_000),
  ]);

  _profileLoading = false;

  // Update state without triggering a re-render loop
  // by directly mutating AppState fields that profile screen owns
  if (profileResult?.data) {
    AppState.profile = profileResult.data;
  }

  const items = itemsResult?.data ?? [];
  AppState.myItems = items;

  panel.innerHTML = _html(items);
  _bindDOM(items);
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function _html(items) {
  const user     = AppState.user ?? {};
  const profile  = AppState.profile ?? {};
  const name     = profile.name
                || user.user_metadata?.full_name
                || user.email?.split('@')[0]
                || 'You';
  const city     = user.home_city || profile.home_city || '';
  const since    = _memberSince(user.created_at);
  const radius   = AppState.swapRadius ?? 5;
  const rating   = profile.rating;
  const swaps    = profile.swap_count ?? 0;
  const initials = _initials(name);

  const metaParts = [city, `swapping since ${since || '2026'}`, rating ? `★ ${rating}` : null].filter(Boolean);

  return `
    <div class="profile-screen">

      <!-- Header row -->
      <div class="profile-header">
        <h2 class="profile-heading">Profile</h2>
        <button class="back-btn" id="btn-profile-settings" aria-label="Settings">
          <i data-lucide="settings"></i>
        </button>
      </div>

      <!-- Scrollable body -->
      <div class="profile-scroll">

        <!-- Identity -->
        <div class="profile-identity">
          <div class="profile-avatar-circle">${_esc(initials)}</div>
          <div>
            <div class="profile-name">${_esc(name)}</div>
            <div class="profile-meta">${_esc(metaParts.join(' · '))}</div>
          </div>
        </div>

        <!-- Stat tiles -->
        <div class="stat-tiles">
          <div class="stat-tile">
            <span class="stat-tile-value">${swaps}</span>
            <span class="stat-tile-label">swaps done</span>
          </div>
          <div class="stat-tile">
            <span class="stat-tile-value">${items ? items.length : '…'}</span>
            <span class="stat-tile-label">on the table</span>
          </div>
          <div class="stat-tile">
            <span class="stat-tile-value">${rating ? `★ ${rating}` : '—'}</span>
            <span class="stat-tile-label">rating</span>
          </div>
        </div>

        <!-- Hunt radius card -->
        <div class="radius-card">
          <div class="radius-header">
            <span class="profile-name" style="font-size:15px;">Hunt radius</span>
            <span class="profile-meta" id="radius-value">${radius} km</span>
          </div>
          <input
            class="radius-slider"
            id="radius-slider"
            type="range"
            min="1" max="50" step="1"
            value="${radius}"
            aria-label="Hunt radius in kilometres"
          />
          <div class="radius-labels">
            <span>1 km</span>
            <span>50 km</span>
          </div>
        </div>

        <!-- Listings section -->
        <div>
          <div class="listings-header" style="margin-bottom:10px;">
            <span class="profile-name" style="font-size:15px;">Your listings</span>
            <button class="listings-manage" id="btn-listings-manage">
              ${_manageMode ? 'done' : 'manage'}
            </button>
          </div>

          ${items === null
            ? _listingsSkeleton()
            : _listingsGrid(items)
          }
        </div>

        <!-- Sign out -->
        <div class="profile-signout">
          <button class="btn-ghost-danger" id="btn-signout">Sign out</button>
        </div>

      </div>
    </div>
  `;
}

function _listingsGrid(items) {
  const cards = items.map(item => _listingCard(item)).join('');
  const addTile = `
    <div class="listing-card" id="btn-listing-add">
      <div class="listing-thumb listing-thumb--add">
        <i data-lucide="plus"></i>
      </div>
      <span class="listing-title" style="color:var(--text-muted);text-align:center;">add</span>
    </div>
  `;
  return `<div class="listings-grid">${cards}${addTile}</div>`;
}

function _listingCard(item) {
  const thumb    = item.images?.[0] ?? '';
  const daysLeft = _daysLeft(item.expires_at);
  const urgent   = daysLeft <= 3;
  const thumbStyle = thumb
    ? `background:url('${_esc(thumb)}') center/cover var(--surface-alt);`
    : `background:var(--surface-alt);`;
  return `
    <div class="listing-card" data-item-id="${item.id}">
      <div class="listing-thumb" style="${thumbStyle}">
        ${_manageMode ? `
          <button class="listing-delete-btn" data-delete-id="${item.id}" aria-label="Delete">
            <i data-lucide="x"></i>
          </button>
        ` : ''}
      </div>
      <span class="listing-title">${_esc(item.title)}</span>
      ${item.expires_at ? `
        <span class="listing-expiry${urgent ? ' listing-expiry--urgent' : ''}">
          ${daysLeft}d left
        </span>` : ''}
    </div>
  `;
}

function _listingsSkeleton() {
  return `
    <div class="listings-grid">
      ${Array.from({ length: 3 }, () => `
        <div class="listing-card">
          <div class="listing-thumb profile-skeleton-block"></div>
          <div class="profile-skeleton-line"></div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── DOM binding ───────────────────────────────────────────────────────────────

// Stored so we can remove stale listeners before adding new ones
let _panelClickHandler = null;

function _bindDOM(items) {
  const panel = document.getElementById('left-nav-panel');
  if (!panel) return;

  // Radius slider — live update only, no setState
  const slider = document.getElementById('radius-slider');
  const label  = document.getElementById('radius-value');
  if (slider) {
    // Live label update — no setState, no re-render
    slider.addEventListener('input', () => {
      const v = parseInt(slider.value, 10);
      if (label) label.textContent = `${v} km`;
    });
    // Persist to state only on release (fires once per drag, not per pixel)
    slider.addEventListener('change', () => {
      const v = parseInt(slider.value, 10);
      AppState.swapRadius = v;
      console.log('[profile] swapRadius →', v);
    });
  }

  // Remove stale click handler before attaching new one
  if (_panelClickHandler) {
    panel.removeEventListener('click', _panelClickHandler);
  }

  _panelClickHandler = async (e) => {
    // Delete button
    const deleteBtn = e.target.closest('[data-delete-id]');
    if (deleteBtn) {
      const itemId = deleteBtn.dataset.deleteId;
      await _deleteItem(itemId);
      return;
    }

    const id = e.target.closest('[id]')?.id;
    switch (id) {
      case 'btn-profile-settings': navigateTo('settings'); break;
      case 'btn-listings-manage':
        _manageMode = !_manageMode;
        _refreshListingsGrid();
        break;
      case 'btn-listing-add':      navigateTo('addItem'); break;
      case 'btn-signout':          _signOut(); break;
    }
  };

  panel.addEventListener('click', _panelClickHandler);

  // Re-initialise Lucide icons
  if (window.lucide) window.lucide.createIcons();
}

// ── Manage mode helpers ───────────────────────────────────────────────────────

function _refreshListingsGrid() {
  const grid = document.querySelector('.listings-grid');
  const manageBtn = document.getElementById('btn-listings-manage');
  if (manageBtn) manageBtn.textContent = _manageMode ? 'done' : 'manage';
  if (grid) {
    grid.outerHTML = _listingsGrid(AppState.myItems ?? []);
  }
  // Re-query after outerHTML replacement
  if (window.lucide) window.lucide.createIcons();
}

async function _deleteItem(itemId) {
  console.log('[profile] deleting item', itemId);
  const { error } = await deleteItem(itemId);
  if (error) { console.error('[profile] delete failed', error); return; }

  // Remove from local state and bust cache
  AppState.myItems = (AppState.myItems ?? []).filter(i => String(i.id) !== String(itemId));
  invalidate('myItems');

  // Update listings grid in place
  const grid = document.querySelector('.listings-grid');
  if (grid) grid.outerHTML = _listingsGrid(AppState.myItems);

  // Update stat tile
  const onTable = document.querySelector('.stat-tile:nth-child(2) .stat-tile-value');
  if (onTable) onTable.textContent = AppState.myItems.length;

  // Sync offer strip on the swipe panel
  const { refreshOfferStrip } = await import('./swipe.js');
  refreshOfferStrip?.();

  if (window.lucide) window.lucide.createIcons();
}

// ── Sign out ──────────────────────────────────────────────────────────────────

async function _signOut() {
  const { signOut } = await import('../api.js');
  await signOut();
  setState({ user: null, session: null, profile: null });
  navigateTo('auth');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function _memberSince(createdAt) {
  if (!createdAt) return '';
  return new Date(createdAt).getFullYear();
}

function _daysLeft(expiresAt) {
  if (!expiresAt) return 99;
  return Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 86_400_000));
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
