/**
 * Swipe (Hunt) screen.
 *
 * Layout (z-order, bottom to top):
 *   1. <canvas>          — card stack (peek cards + top card with photo/stamps)
 *   2. .swipe-overlay    — DOM controls layered over canvas:
 *      - photo angle dots
 *      - ⤢ expand button
 *      - SWAP/PASS stamp divs (opacity driven by drag)
 *      - card info strip at bottom (for photo viewer trigger)
 *   3. Offer picker strip (above canvas)
 *   4. Pass / Undo / Like action buttons (below canvas)
 *   5. Full-screen photo viewer (fixed overlay)
 *
 * Canvas handles all card rendering. DOM handles interaction affordances.
 */

import { AppState, setState } from '../state.js';
import { navigateTo }         from '../router.js';
import { fetchFeed, recordSwipe, getMyItems } from '../api.js';
import { cached, invalidate }                from '../cache.js';
import { enqueueSwipe }       from '../resilience.js';
import {
  initCardStack, drawFrame, drawIdle,
  stampOpacity, THRESHOLD,
} from '../canvas/cardStack.js';

// ── Module state ──────────────────────────────────────────────────────────────

let _canvas      = null;
let _likeEl      = null;
let _passEl      = null;
let _rafId       = null;
let _dragging    = false;
let _startX      = 0;
let _startY      = 0;
let _dx          = 0;
let _dy          = 0;
let _initialized = false;
let _feedLoading = false;

// ── Render ────────────────────────────────────────────────────────────────────

export function renderSwipe() {
  const panel = document.getElementById('center-swipe-panel');
  if (!panel) return;

  panel.innerHTML = _html();
  _bindDOM();

  // Init canvas only once; re-use on re-renders
  _canvas = panel.querySelector('#card-canvas');
  _likeEl = panel.querySelector('#stamp-like');
  _passEl = panel.querySelector('#stamp-pass');

  if (_canvas) {
    initCardStack(
      _canvas,
      () => AppState.swipeQueue,
      () => AppState.photoIndex,
    );
    drawIdle();
  }

  // Fetch feed if deck is empty (guard against re-entrant calls)
  if (!AppState.swipeQueue.length && !_feedLoading) _loadFeed();

  // Load user's items if not yet loaded
  if (!AppState.myItems) _loadMyItems();

  // Initialise Lucide icons rendered in this screen
  if (window.lucide) window.lucide.createIcons();
}

// ── HTML template ─────────────────────────────────────────────────────────────

function _html() {
  const s        = AppState;
  const deck     = s.swipeQueue;
  const cur      = deck[0] || null;
  const myItems  = s.myItems || [];
  const hasPeek1 = !!deck[1];
  const hasPeek2 = !!deck[2];

  const city   = s.user?.home_city ?? 'Nearby';
  const radius = s.swapRadius ?? 5;

  return `
    <div class="swipe-screen">

      <!-- Header -->
      <div class="hunt-header">
        <span class="hunt-brand">swapp</span>
        <button class="location-chip" id="btn-radius">
          ${_esc(city)} &middot; ${radius} km
          <i data-lucide="chevron-down"></i>
        </button>
      </div>

      <!-- Offer strip -->
      <div class="offer-section">
        <span class="kicker">OFFER ONE OF YOURS &darr;</span>

        ${myItems.length === 0 ? `
          <p class="offer-nudge">Add an item to start swapping</p>
        ` : `
          <div class="offer-strip-scroll" id="offer-scroll">
            ${myItems.map((item, i) => `
              <button
                class="offer-chip-btn ${i === s.offerIndex ? 'offer-chip-btn--active' : ''}"
                data-offer-index="${i}"
                style="background-image:url('${_itemThumb(item)}')"
                aria-label="${_esc(item.title)}"
              ></button>
            `).join('')}
            <button class="offer-chip-add" id="btn-add-item" aria-label="Add an item">
              <i data-lucide="plus"></i>
            </button>
          </div>
        `}
      </div>

      <!-- Card stack area -->
      <div class="card-area" id="card-area">

        ${hasPeek2 ? '<div class="peek-card peek-card--2"></div>' : ''}
        ${hasPeek1 ? '<div class="peek-card peek-card--1"></div>' : ''}

        ${cur ? `
          <!-- Canvas — card renderer -->
          <canvas id="card-canvas" class="card-canvas"
            aria-label="${_esc(cur.title)} by ${_esc(cur.owner)}"></canvas>

          <!-- DOM overlay (stamps + photo dots + expand) -->
          <div class="swipe-overlay" id="swipe-overlay">

            <!-- SWAP stamp -->
            <div class="stamp stamp-like" id="stamp-like" aria-hidden="true">SWAP</div>
            <!-- PASS stamp -->
            <div class="stamp stamp-pass" id="stamp-pass" aria-hidden="true">PASS</div>

            <!-- Photo angle dots -->
            <div class="photo-dots" id="photo-dots">
              ${Array.from({ length: cur.photos || 1 }, (_, i) => `
                <button class="photo-dot ${i === s.photoIndex ? 'photo-dot--active' : ''}"
                  data-photo-index="${i}" aria-label="Photo ${i + 1}"></button>
              `).join('')}
            </div>

            <!-- Expand to full-screen -->
            <button class="expand-btn" id="btn-expand" aria-label="View full screen">
              <i data-lucide="expand"></i>
            </button>

            <!-- Expiry badge -->
            ${cur.expires_at ? `
              <div class="expiry-badge ${_urgentClass(cur.expires_at)}" id="expiry-badge">
                ${_daysLeft(cur.expires_at)} days left
              </div>
            ` : ''}
          </div>

        ` : `
          <!-- Empty deck -->
          <div class="deck-empty">
            <i data-lucide="search-x"></i>
            <h3>You're all caught up</h3>
            <p>No more finds nearby. Widen your range or check back soon.</p>
            <button class="btn btn-primary" id="btn-reset" style="width:auto;padding:12px 24px;">
              Start over
            </button>
          </div>
        `}
      </div>

      <!-- Action buttons -->
      <div class="swipe-actions">
        <button class="fab-pass" id="btn-skip" aria-label="Pass">
          <i data-lucide="x"></i>
        </button>
        <button class="fab-undo" id="btn-undo" aria-label="Undo" ${!deck.length ? 'disabled' : ''}>
          <i data-lucide="undo-2"></i>
        </button>
        <button class="fab-like" id="btn-like" aria-label="Offer swap">
          <i data-lucide="heart"></i>
        </button>
      </div>

    </div>

    <!-- Full-screen photo viewer (fixed, shown when viewerOpen) -->
    ${_viewerHTML(cur)}
  `;
}

function _viewerHTML(cur) {
  if (!cur || !AppState.viewerOpen) return '';
  const url = cur.photo_urls?.[AppState.photoIndex]
    ?? `https://picsum.photos/seed/${cur.seed}-${AppState.photoIndex}/600/800`;
  return `
    <div class="photo-viewer-overlay" id="photo-viewer-overlay">
      <div class="photo-viewer-img" style="background:url('${url}') center/contain no-repeat #000;"></div>
      <button class="photo-viewer-close" id="btn-viewer-close" aria-label="Close">
        <i data-lucide="x"></i>
      </button>
      <button class="photo-viewer-prev" id="btn-viewer-prev" aria-label="Previous photo">
        <i data-lucide="chevron-left"></i>
      </button>
      <button class="photo-viewer-next" id="btn-viewer-next" aria-label="Next photo">
        <i data-lucide="chevron-right"></i>
      </button>
    </div>
  `;
}

// ── DOM binding ───────────────────────────────────────────────────────────────

let _panelClickHandler = null;
let _areaPointerHandler = null;

function _bindDOM() {
  const panel = document.getElementById('center-swipe-panel');
  if (!panel) return;

  if (_panelClickHandler) panel.removeEventListener('click', _panelClickHandler);
  _panelClickHandler = _handleClick;
  panel.addEventListener('click', _panelClickHandler);

  // Pointer drag on canvas area
  const area = panel.querySelector('#card-area');
  if (area) {
    if (_areaPointerHandler) area.removeEventListener('pointerdown', _areaPointerHandler);
    _areaPointerHandler = _onPointerDown;
    area.addEventListener('pointerdown', _areaPointerHandler);
  }
}

function _handleClick(e) {
  const id      = e.target.closest('[id]')?.id;
  const action  = e.target.closest('[data-offer-index]');
  const photoDot = e.target.closest('[data-photo-index]');

  if (action) {
    const idx = parseInt(action.dataset.offerIndex, 10);
    setState({ offerIndex: idx });
    renderSwipe();
    return;
  }
  if (photoDot) {
    e.stopPropagation();
    const idx = parseInt(photoDot.dataset.photoIndex, 10);
    setState({ photoIndex: idx });
    drawIdle();
    return;
  }

  switch (id) {
    case 'btn-like':          _commitSwipe('like'); break;
    case 'btn-skip':          _commitSwipe('skip'); break;
    case 'btn-undo':          _undo(); break;
    case 'btn-reset':         _resetDeck(); break;
    case 'btn-add-item':      navigateTo('addItem'); break;
    case 'btn-expand':        setState({ viewerOpen: true }); renderSwipe(); break;
    case 'btn-viewer-close':  setState({ viewerOpen: false }); renderSwipe(); break;
    case 'btn-viewer-prev':   _prevPhoto(); break;
    case 'btn-viewer-next':   _nextPhoto(); break;
    case 'btn-radius':        /* TODO: open radius picker */ break;
  }
}

// ── Drag / swipe mechanics ────────────────────────────────────────────────────

function _onPointerDown(e) {
  if (!AppState.swipeQueue[0]) return;
  _dragging = true;
  _startX   = e.clientX;
  _startY   = e.clientY;
  _dx = _dy = 0;

  const onMove = (ev) => {
    if (!_dragging) return;
    _dx = ev.clientX - _startX;
    _dy = ev.clientY - _startY;

    if (_rafId) cancelAnimationFrame(_rafId);
    _rafId = requestAnimationFrame(() => {
      drawFrame(_dx, _dy);
      _updateStamps(_dx);
    });
  };

  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup',   onUp);
    if (!_dragging) return;
    _dragging = false;
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }

    const moved = Math.abs(_dx) + Math.abs(_dy);
    if (moved < 8) {
      _handlePhotoTap();
    } else if (_dx > THRESHOLD) {
      _commitSwipe('like');
    } else if (_dx < -THRESHOLD) {
      _commitSwipe('skip');
    } else {
      _resetCard();
    }
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup',   onUp);
}

function _updateStamps(dx) {
  const { like, pass } = stampOpacity(dx);
  if (_likeEl) _likeEl.style.opacity = like;
  if (_passEl) _passEl.style.opacity = pass;
}

function _resetCard() {
  _updateStamps(0);
  drawIdle();
}

function _handlePhotoTap() {
  const canvas = document.getElementById('card-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const rel  = (_startX - rect.left) / rect.width;
  if (rel < 0.45) _prevPhoto(); else _nextPhoto();
}

// ── Swipe commit ──────────────────────────────────────────────────────────────

async function _commitSwipe(dir) {
  const cur = AppState.swipeQueue[0];
  if (!cur) return;

  // Like requires at least one item to offer
  if (dir === 'like') {
    const myItems = AppState.myItems;
    if (!myItems?.length) {
      _showNudge('Add an item first to offer a swap');
      return;
    }
    const offerIdx = AppState.offerIndex ?? 0;
    if (!myItems[offerIdx]) {
      _showNudge('Add an item first to offer a swap');
      return;
    }
  }

  // Optimistic: pop card immediately
  setState(s => ({
    swipeQueue: s.swipeQueue.slice(1),
    photoIndex: 0,
  }));
  drawIdle();
  _updateStamps(0);
  renderSwipe();

  // Network: record swipe
  const payload = {
    swiperId:       AppState.user?.id,
    targetItemId:   cur.id,
    targetOwnerId:  cur.user_id,
    isLike:         dir === 'like',
  };

  if (!AppState.online) {
    enqueueSwipe(payload);
    return;
  }

  const { data, error } = await recordSwipe(payload);
  if (error) { enqueueSwipe(payload); return; }

  // Match detected by backend?
  if (data?.matched && dir === 'like') {
    invalidate('swaps'); // new swap exists — bust matches/activity cache
    setState({
      matchedItem:   cur,
      matchedSwap:   { id: data.swap_id },
      swapConfirmed: false,
    });
    navigateTo('match');
  }

  // Prefetch more when deck runs low — bust cache so we get fresh cards
  if (AppState.swipeQueue.length < 3) {
    invalidate('feed');
    _loadFeed();
  }
}

function _showNudge(msg) {
  const panel = document.getElementById('center-swipe-panel');
  if (!panel) return;
  const existing = panel.querySelector('.swipe-nudge-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'swipe-nudge-toast';
  toast.textContent = msg;
  panel.appendChild(toast);

  // Auto-dismiss
  setTimeout(() => toast.remove(), 3000);
}

function _undo() {
  _loadFeed();
}

async function _resetDeck() {
  setState({ photoIndex: 0 });
  await _loadFeed();
}

// ── Feed loading ──────────────────────────────────────────────────────────────

async function _loadFeed() {
  const u = AppState.user;
  if (!u?.id || !u?.home_city) return;
  if (_feedLoading) return;

  _feedLoading = true;
  try {
    const { data, error } = await cached('feed', () => fetchFeed({
      city:   u.home_city,
      userId: u.id,
    }), 120_000);

    if (!error && data?.items?.length) {
      // Mutate directly — setState would trigger render → renderSwipe → _loadFeed loop
      AppState.swipeQueue = data.items;
      AppState.photoIndex = 0;
      renderSwipe();
    }
  } finally {
    _feedLoading = false;
  }
}

let _myItemsLoading = false;

async function _loadMyItems() {
  const u = AppState.user;
  if (!u?.id || _myItemsLoading) return;

  _myItemsLoading = true;
  try {
    const { data, error } = await cached('myItems', () => getMyItems(u.id), 60_000);
    if (!error && data) {
      console.log('[myItems] fetched', data.length, 'items:', data.map(i => i.title));
      // Mutate directly — avoids setState → render → _loadMyItems loop
      AppState.myItems = data;
      // Update just the offer strip in the DOM without full re-render
      _refreshOfferStrip();
    }
  } catch (err) {
    console.warn('_loadMyItems failed', err);
  } finally {
    _myItemsLoading = false;
  }
}

// ── Photo helpers ─────────────────────────────────────────────────────────────

function _prevPhoto() {
  setState(s => ({ photoIndex: Math.max(0, s.photoIndex - 1) }));
  drawIdle();
  _refreshDots();
}

function _nextPhoto() {
  const cur = AppState.swipeQueue[0];
  if (!cur) return;
  const max = (cur.photos || cur.photo_urls?.length || 1) - 1;
  setState(s => ({ photoIndex: Math.min(max, s.photoIndex + 1) }));
  drawIdle();
  _refreshDots();
}

function _refreshDots() {
  const dots = document.getElementById('photo-dots');
  if (!dots) return;
  const cur = AppState.swipeQueue[0];
  if (!cur) return;
  const n = cur.photos || cur.photo_urls?.length || 1;
  dots.innerHTML = Array.from({ length: n }, (_, i) => `
    <button class="photo-dot ${i === AppState.photoIndex ? 'photo-dot--active' : ''}"
      data-photo-index="${i}" aria-label="Photo ${i + 1}"></button>
  `).join('');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function refreshOfferStrip() { _refreshOfferStrip(); }

function _refreshOfferStrip() {
  const section = document.querySelector('.offer-section');
  if (!section) return;
  const myItems = AppState.myItems || [];
  const offerIndex = AppState.offerIndex;

  if (myItems.length === 0) {
    section.innerHTML = `
      <span class="kicker">OFFER ONE OF YOURS &darr;</span>
      <p class="offer-nudge">Add an item to start swapping</p>
    `;
  } else {
    section.innerHTML = `
      <span class="kicker">OFFER ONE OF YOURS &darr;</span>
      <div class="offer-strip-scroll" id="offer-scroll">
        ${myItems.map((item, i) => `
          <button
            class="offer-chip-btn ${i === offerIndex ? 'offer-chip-btn--active' : ''}"
            data-offer-index="${i}"
            style="background-image:url('${_itemThumb(item)}')"
            aria-label="${_esc(item.title)}"
          ></button>
        `).join('')}
        <button class="offer-chip-add" id="btn-add-item" aria-label="Add an item">
          <i data-lucide="plus"></i>
        </button>
      </div>
    `;
    document.getElementById('btn-add-item')?.addEventListener('click', () => navigateTo('addItem'));
    document.querySelectorAll('[data-offer-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.offerIndex = parseInt(btn.dataset.offerIndex, 10);
        _refreshOfferStrip();
      });
    });
  }
  window.__lucide?.();
}

function _itemThumb(item) {
  return item.images?.[0] ?? item.photo_urls?.[0] ?? '';
}

function _daysLeft(expiresAt) {
  const ms = new Date(expiresAt) - new Date();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function _urgentClass(expiresAt) {
  return _daysLeft(expiresAt) <= 3 ? 'expiry-badge--urgent' : '';
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
